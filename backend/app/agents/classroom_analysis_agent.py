import os
import json
import google.generativeai as genai
from typing import Dict, Any, List

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

teacher_prompt = """
You are an expert Educational Data Analyst reporting to a TEACHER. 
Analyze the provided classroom data and generate a premium "Classroom Intelligence Report".

Classroom Data:
{class_data}

Sections to include:
1. **Class Health Snapshot**: High-level overview of performance.
2. **Mastery Gaps**: Identify topics where the class as a whole is struggling.
3. **Engagement Analysis**: How many students are falling behind on assignments?
4. **Actionable Recommendations**: Specific pedagogical steps for the instructor.

Tone: Analytical, professional, and supportive.
"""

student_prompt = """
You are a personalized AI Academic Mentor reporting to a STUDENT.
Analyze their performance in this course and generate a "Personal Progress Analysis".

Personal Data:
{class_data}

Sections to include:
1. **Your Standing**: How are you doing in the course overall?
2. **Strength & Growth Areas**: What are you best at, and what should you practice more?
3. **GPA Insights**: A look at your average marks and estimated GPA.
4. **Your Growth Path**: 3 specific tips for you to improve your marks.

Tone: Encouraging, motivating, and clear.
"""

async def generate_classroom_analysis(class_data: Dict[str, Any]) -> str:
    """Generates an AI-driven analysis report tailored to the user's role."""
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return "Analysis unavailable: API Key not configured."

    role = class_data.get("role", "student")
    base_prompt = teacher_prompt if role == "teacher" else student_prompt

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        prompt = base_prompt.format(
            class_data=json.dumps(class_data, indent=2)
        )
        
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=4096,
                temperature=0.5,
            )
        )
        
        return response.text
    except Exception as e:
        print(f"Analysis Agent Error: {e}")
        return f"I encountered an error generating your analysis: {str(e)}"
