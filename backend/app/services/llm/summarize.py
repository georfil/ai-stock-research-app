from app.services.llm.llm_client import ask
from app.services.llm.prompts import BUSINESS_SUMMARY_PROMPT
from app.core.config import get_config

def summarize_business_info(business_section: str) -> str:
    response = ask(text=business_section, system=BUSINESS_SUMMARY_PROMPT, model=get_config().llm_model)
    return response