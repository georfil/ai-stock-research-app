import logging
import operator
from typing import Annotated, NotRequired, TypedDict, Literal, List
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field
from langgraph.graph import START, END, StateGraph
from langgraph.types import Send

from app.services.llm.llm_client import get_model
from app.services.llm.prompts import (
    ANSWER_TEMPLATE,
    FINANCIAL_ANALYST_PROMPT,
    REFORMULATE_TEMPLATE,
    SUPERVISOR_PROMPT,
    FILING_ANALYST_PROMPT,
)
from app.services.financial_data import fetch_financial_statement
from app.services.filings_data import fetch_filing_section

logger = logging.getLogger(__name__)

# =============================================================================
# Config
# =============================================================================

DEFAULT_MAX_ITERATIONS = 3


# =============================================================================
# Pipeline state
# =============================================================================

class PipelineState(TypedDict):
    raw_task: str
    task: str       # User's question reformulated
    history: list[BaseMessage]   # Prior turns
    assignments: list['Assignment'] # Assignments from supervisor to workers
    results: Annotated[list['WorkerResult'], operator.add] # results of worker's assignments
    iteration: int
    max_iterations: int
    ticker: str
    


# =============================================================================
# Workers
# =============================================================================

financial_analyst = create_agent(
    model = get_model(),
    tools = [fetch_financial_statement],
    system_prompt=FINANCIAL_ANALYST_PROMPT
)

filing_analyst = create_agent(
    model= get_model(),
    tools = [fetch_filing_section],
    system_prompt=FILING_ANALYST_PROMPT
)

WORKERS = Literal["financial analyst", "filing analyst"]

WORKER_AGENTS = {
    "financial analyst": financial_analyst,
    "filing analyst": filing_analyst,
}


class WorkerInput(TypedDict):
    assignment: 'Assignment'
    iteration: int
    task: str
    results: NotRequired[list['WorkerResult']]
    ticker: str


class WorkerResult(BaseModel):
    worker: WORKERS
    iteration: int
    subtask: str
    output: str



# =============================================================================
# Supervisor
# =============================================================================

class Assignment(BaseModel):
    worker: WORKERS = Field(
        description="Which worker to assign"
    )
    subtask: str = Field(
        description="What the worker should do"
    )


class SupervisorDecision(BaseModel):
    assignments: List[Assignment] = Field(
        default_factory=list,
        description="Tasks to assign to workers"
    )
    is_complete: bool = Field(
        description="Whether all work is done"
    )

supervisor_model = get_model().with_structured_output(SupervisorDecision)


# =============================================================================
# Graph nodes
# =============================================================================

def reformulate_question(state: PipelineState):
    """Rewrite the raw question into a standalone one using chat history.

    Folds prior turns into the wording of the question itself (e.g. resolving
    pronouns/references) so downstream nodes can reason about ``task`` without
    needing the conversation history. Passes the question through unchanged
    when there's no history to fold in.
    """
    #If history is empty, return the question as is
    if not state["history"]:
        logger.info("reformulate_question: no history, using raw_task as-is: %r", state["raw_task"])
        return {
            "task": state["raw_task"]
        }

    # Reformulation user's question so it contains all the context needs to stand on its own
    reformulate_chain = REFORMULATE_TEMPLATE | get_model() | StrOutputParser()
    standalone_question = reformulate_chain.invoke({
        "chat_history": state["history"],
        "question": state["raw_task"]
    })

    logger.info("reformulate_question: %r -> %r", state["raw_task"], standalone_question)

    return {
        "task": standalone_question
    }

def supervisor(state: PipelineState):

    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", DEFAULT_MAX_ITERATIONS)

    logger.info("supervisor: iteration %d/%d", iteration, max_iterations)

    if iteration >= max_iterations: # Max Iterations reached, force synthesis
        logger.info("supervisor: max iterations reached, forcing synthesis")
        return {
            "assignments": []
        }

    prompt = f"""<task>{state["task"]}</task>
    <worker_results>
    {format_worker_results(state.get("results", []))}
    </worker_results>"""

    decision: SupervisorDecision = supervisor_model.invoke([
        SystemMessage(content=SUPERVISOR_PROMPT),
        HumanMessage(content=prompt),
    ])

    #Supervisor decided the gathered results are enough to answer
    if decision.is_complete:
        logger.info("supervisor: work complete")
        return {
            "assignments": []
        }

    #Guardrail: No assignment, no completion — stop and answer with what we have
    if not decision.assignments:
        logger.warning("supervisor: not complete but no assignments given, stopping")
        return {
            "assignments": []
        }

    logger.info(
        "supervisor: assigning %d task(s): %s",
        len(decision.assignments),
        [(a.worker, a.subtask) for a in decision.assignments],
    )

    return {
        "assignments": decision.assignments,
        "iteration": iteration + 1,
    }


def worker(state: WorkerInput):
    assignment = state["assignment"]
    agent = WORKER_AGENTS[assignment.worker]
    logger.info("worker: %s starting subtask (ticker=%s): %r", assignment.worker, state["ticker"], assignment.subtask)
    prompt = (
        f"<ticker>{state['ticker']}</ticker>\n"
        f"<task>{state['task']}</task>\n"
        f"<subtask>{assignment.subtask}</subtask>\n"
        f"<worker_results>\n{format_worker_results(state.get('results', []))}\n</worker_results>"
    )
    response = agent.invoke({"messages": [HumanMessage(content=prompt)]})
    output = response["messages"][-1].content
    logger.info("worker: %s finished, output=%r", assignment.worker, output)
    return {
        "results": [WorkerResult(
            worker=assignment.worker,
            iteration=state["iteration"],
            subtask=assignment.subtask,
            output=output,
        )]
    }

def route(state: PipelineState):
    #Dispatch assignments of supervisor
    if state.get("assignments"):
        logger.info("route: dispatching %d assignment(s) to worker", len(state["assignments"]))
        return [
            Send("worker", {
                "assignment": a,
                "iteration": state["iteration"],
                "task": state["task"],
                "results": state.get("results", []),
                "ticker": state["ticker"]
            })
            for a in state["assignments"]
        ]

    #No more assignments: gathering is done, the caller writes the answer
    logger.info("route: no assignments -> END")
    return END

# =============================================================================
# Helpers
# =============================================================================

def format_worker_results(results: list[WorkerResult]) -> str:
    """Render worker results as XML-tagged blocks for inclusion in an LLM prompt.

    Tags keep each result unambiguous even when ``output`` itself spans
    multiple lines or contains characters that would clash with a plain
    bullet-list format.
    """
    if not results:
        return "No worker results yet."

    return "\n".join(
        f"""<worker_result iteration="{r.iteration}" worker="{r.worker}">
<subtask>{r.subtask}</subtask>
<output>
{r.output}
</output>
</worker_result>"""
        for r in results
    )


# =============================================================================
# Graph Assembly
# =============================================================================

g = StateGraph(PipelineState)

g.add_node(reformulate_question)
g.add_node(supervisor)
g.add_node(worker)

g.add_edge(START, "reformulate_question")
g.add_edge("reformulate_question", "supervisor")
g.add_conditional_edges("supervisor", route)
g.add_edge("worker", "supervisor")

graph = g.compile()

# =============================================================================
# Answer generation
# =============================================================================
# Runs after the graph settles on the gathered results.

answer_chain = ANSWER_TEMPLATE | get_model() | StrOutputParser()