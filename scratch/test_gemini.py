import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

class RiskExplanation(BaseModel):
    summary: str
    risk_level: str
    primary_motifs: list[str]
    compliance_recommendation: str

client = genai.Client(api_key=api_key)
prompt = "Analyze this AML transaction: 3-hop circular flow, burst velocity 12 tx/24h, PII-masked account ACCT-***-1A0."

for model_name in ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-1.5-flash"]:
    try:
        print(f"Trying {model_name}...")
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RiskExplanation,
            )
        )
        print(f"Success with {model_name}!")
        print("Response:", response.text)
        break
    except Exception as e:
        print(f"Failed {model_name}: {e}")
