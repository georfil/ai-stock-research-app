import operator
from typing import Annotated, TypedDict, Literal, List
from langchain.agents import create_agent
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field
from langgraph.graph import START, END, StateGraph
from langgraph.types import Send

from app.services.llm.llm_client import get_model
from app.services.llm.prompts import (
    FINANCIAL_ANALYST_PROMPT,
    REFORMULATE_TEMPLATE,
    SUPERVISOR_PROMPT,
    SYNTHESIZER_TEMPLATE,
)
from app.services.financial_data import fetch_financial_statement

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
    final_answer: str  # Final Answer of supervisor based on worker results
    results: Annotated[list['WorkerResult'], operator.add] # results of worker's assignments
    iteration: int
    max_iterations: int
    


# =============================================================================
# Workers
# =============================================================================

financial_analyst = create_agent(
    model = get_model(),
    tools = [fetch_financial_statement],
    system_prompt=FINANCIAL_ANALYST_PROMPT
)

WORKERS = Literal["financial analyst"]

WORKER_AGENTS = {
    "financial analyst": financial_analyst,
}

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
    final_answer: str = Field(
        default="",
        description="Final answer if complete"
    )

supervisor_agent = create_agent(
    model=get_model(),
    tools=[],
    system_prompt=SUPERVISOR_PROMPT,
    response_format=SupervisorDecision,
)


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
        return {
            "task": state["raw_task"]
        }

    # Reformulation user's question so it contains all the context needs to stand on its own
    reformulate_chain = REFORMULATE_TEMPLATE | get_model() | StrOutputParser()
    standalone_question = reformulate_chain.invoke({
        "chat_history": state["history"],
        "question": state["raw_task"]
    })

    return {
        "task": standalone_question
    }

def supervisor(state: PipelineState):

    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", DEFAULT_MAX_ITERATIONS)

    if iteration >= max_iterations: # Max Iterations reached, force synthesis
        return {
            "assignments": []
        }

    prompt = f"""<task>{state["task"]}</task>
    <worker_results>
    {_format_worker_results(state.get("results", []))}
    </worker_results>"""

    supervisor_response = supervisor_agent.invoke(prompt)

    #Supervisor decided he is ready to answer
    if supervisor_response.is_complete:
        return {
            "final_answer": supervisor_response.final_answer.strip(),
            "assignments": []
        }

    #Guardrail: No assignment, no answer, force synthesis
    if not supervisor_response.assignments:
        return {
            "assignments": []
        } 
    
    return {
        "assignments": supervisor_response.assignments,
        "iteration": iteration + 1,
    }


def worker(state: dict):
    assignment = state["assignment"]
    agent = WORKER_AGENTS[assignment.worker]
    prompt = (
        f"<task>{state['task']}</task>\n"
        f"<subtask>{assignment.subtask}</subtask>\n"
        f"<worker_results>\n{_format_worker_results(state.get('results', []))}\n</worker_results>"
    )
    response = agent.invoke({"messages": [HumanMessage(content=prompt)]})
    output = response["messages"][-1].content
    return {
        "results": [WorkerResult(
            worker=assignment.worker,
            iteration=state["iteration"],
            subtask=assignment.subtask,
            output=output,
        )]
    }

def synthesize_answer(state: PipelineState):
    """Force a final answer when the supervisor didn't complete in time.

    Reached when the iteration cap hits or the supervisor stalls without new
    assignments and without a final answer. Writes the best answer possible
    from whatever worker results exist, rather than surfacing nothing.
    """
    synthesizer_chain = SYNTHESIZER_TEMPLATE | get_model() | StrOutputParser()
    final_answer = synthesizer_chain.invoke({
        "task": state["task"],
        "worker_results": _format_worker_results(state.get("results", [])),
    }).strip()

    return {
        "final_answer": final_answer or "I wasn't able to gather enough information to answer this question.",
        "assignments": []
    }



def route(state: PipelineState):
    #Supervisor reached an answer: -> EXIT
    if state.get("final_answer"):
        return END

    #Dispatch assignments of supervisor
    if state.get("assignments"):
        return [
            Send("worker", {
                "assignment": a,
                "iteration": state["iteration"],
                "task": state["task"],
                "results": state.get("results", [])
            })
            for a in state["assignments"]
        ]

    #If no answer and no assignment, synthesize answer based on collected data
    return "synthesize_answer"

# =============================================================================
# Helpers
# =============================================================================

def _format_worker_results(results: list[WorkerResult]) -> str:
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
g.add_node(synthesize_answer)

g.add_edge(START, "reformulate_question")
g.add_edge("reformulate_question", "supervisor")
g.add_conditional_edges("supervisor", route)
g.add_edge("worker", "supervisor")
g.add_edge("synthesize_answer", END)

app = g.compile()