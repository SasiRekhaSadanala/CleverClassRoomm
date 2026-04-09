import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash", 
    temperature=0, 
    google_api_key=os.getenv("GOOGLE_API_KEY", "mock_key")
)

analysis_prompt = PromptTemplate.from_template(
    """
    You are an expert Code Understanding Agent.
    
    Given the following student's code submission, identify the core programming topics and concepts utilized.
    Return a comma-separated list of the key concepts (e.g., 'For-loops', 'Recursion', 'Binary Search', 'Hash Maps').
    Do not explain, just return the list.
    
    Code:
    ```python
    {code}
    ```
    
    Concepts:
    """
)

chain = analysis_prompt | llm | StrOutputParser()

async def analyze_code_semantics(code: str) -> list[str]:
    try:
        if os.getenv("GOOGLE_API_KEY") is None or os.getenv("GOOGLE_API_KEY") == "mock_key":
            # Mock behavior if no key is provided
            if "for" in code:
                return ["Loops", "Basic Syntax"]
            return ["Variables"]
        
        result = await chain.ainvoke({"code": code})
        concepts = [c.strip() for c in result.split(",")]
        return concepts
    except Exception as e:
        print(f"Error in Code Understanding Agent: {e}")
        return []
