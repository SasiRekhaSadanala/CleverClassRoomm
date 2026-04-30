import os
import json
import google.generativeai as genai
from typing import Dict, Any, List

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

analysis_prompt = """
You are an expert Educational Data Analyst. Your goal is to analyze the provided classroom data and generate a premium, high-impact "Feature Analysis" report for the instructor.

Classroom Data:
{class_data}

Instructions:
1. **Be Insightful**: Don't just restate numbers. Explain *what they mean*.
2. **Visual Structure**: Use Markdown headers, bold text, and bullet points. Use Markdown tables for comparisons.
3. **Sections to include**:
   - **Executive Summary**: A high-level overview of class health.
   - **Topic Mastery Analysis**: Identify exactly which concepts the class has mastered and where they are failing.
   - **Student Engagement**: Analyze how active students are based on assignment completion.
   - **Actionable Recommendations**: Provide 3-5 specific, pedagogical steps the teacher should take to improve outcomes.
4. **Tone**: Professional, encouraging, and data-driven.
"""

async def generate_classroom_analysis(class_data: Dict[str, Any]) -> str:
    """Generates an AI-driven analysis report for a classroom."""
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return "Analysis unavailable: API Key not configured."

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        prompt = analysis_prompt.format(
            class_data=json.dumps(class_data, indent=2)
        )
        
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=4096,
                temperature=0.4, # Lower temperature for analytical consistency
            )
        )
        
        return response.text
    except Exception as e:
        print(f"Classroom Analysis Agent Error: {e}")
        return f"I encountered an error while generating the analysis report: {str(e)}"
