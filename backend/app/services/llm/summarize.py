from langchain_core.output_parsers import StrOutputParser

from app.services.llm.llm_client import ask, get_model
from app.services.llm.prompts import BUSINESS_SUMMARY_PROMPT, EXTRACTOR_PROMPT
from app.core.config import get_config

def summarize_business_info(business_section: str) -> str:
    response = ask(text=business_section, system=BUSINESS_SUMMARY_PROMPT, model=get_config().llm_model)
    return response

def retrieve_relevant_context(section_content: str, task: str) -> str:
    """Extract passages from a 10-K section that bear on a given task.

    Runs a cheap extractor model over the full section, returning verbatim
    passages relevant to ``task`` rath  er than a summary. The extraction is a
    gather step, not an analysis step — the returned passages are handed to the
    analyst model downstream, which does the materiality weighting and reasoning.

    Args:
        section_content: Full text of one 10-K section (e.g. MD&A, Risk Factors).
        task: What to look for, phrased as the specific question or theme the
            passages should address, e.g. "sources of margin pressure".

    Returns:
        Relevant passages verbatim, blank-line separated, or the sentinel
        ``NO_RELEVANT_CONTENT`` if the section addresses nothing in ``task``.
    """
    extractor_chain = (
        EXTRACTOR_PROMPT
        | get_model(model=get_config().budget_llm_model)
        | StrOutputParser()
    )
    retrieved_context = extractor_chain.invoke({
        "task": task,
        "section_content": section_content,
    })

    
    return retrieved_context