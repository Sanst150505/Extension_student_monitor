import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_mcq(topic: str, difficulty: str) -> dict:
    """
    Generates a multiple-choice question using OpenAI.
    """
    prompt = f"""
    Generate one multiple-choice question about '{topic}' with a difficulty level of '{difficulty}'.
    Return the response ONLY as a JSON object with the following structure:
    {{
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "The exact text of the correct option from the options list"
    }}
    Ensure the JSON is valid and contains no extra text.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful educational assistant that generates high-quality MCQs."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        import random
        print(f"[OpenAI] ⚠️ Failed to generate question: {e}")
        
        # ── Universal Fallback Pool ──────────────────────────────────────────
        fallbacks = [
            {
                "question": "Which planet is known as the Red Planet?",
                "options": ["Earth", "Mars", "Venus", "Jupiter"],
                "answer": "Mars"
            },
            {
                "question": "What do plants need to make their own food?",
                "options": ["Sunlight", "Milk", "Chocolate", "Pizza"],
                "answer": "Sunlight"
            },
            {
                "question": "How many colors are there in a rainbow?",
                "options": ["5", "6", "7", "10"],
                "answer": "7"
            },
            {
                "question": "Which animal is known as the King of the Jungle?",
                "options": ["Elephant", "Tiger", "Lion", "Giraffe"],
                "answer": "Lion"
            },
            {
                "question": "What part of the body do we use to see?",
                "options": ["Ears", "Nose", "Eyes", "Hands"],
                "answer": "Eyes"
            }
        ]
        
        return random.choice(fallbacks)
