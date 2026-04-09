from app.models.user import User
from datetime import datetime

async def update_knowledge_profile(
    user_id: str,
    concepts: list[str],
    correctness_score: float,
    source: str = "assignment",
):
    """
    Analytics Agent dynamically updates the knowledge profile
    based on the concepts extracted by the Code Understanding Agent.
    """
    user = await User.get(user_id)
    if not user:
        return
        
    # Standard knowledge update formula
    # Moving average approach to smooth out performance
    for concept in concepts:
        concept = concept.lower()
        current_score = user.knowledge_profile.get(concept, 50.0) # Default mid-point
        
        # Adjust weight based on correctness
        # If code was correct (e.g. 100%), score moves up. If 0%, goes down.
        adjustment = (correctness_score - 50) * 0.2
        new_score = current_score + adjustment
        
        # Clamp between 0 and 100
        new_score = max(0.0, min(100.0, new_score))
        user.knowledge_profile[concept] = new_score

        history = user.topic_activity.get(concept, [])
        history.append(
            {
                "timestamp": datetime.utcnow().isoformat(),
                "source": source,
                "input_score": round(float(correctness_score), 2),
                "resulting_score": round(float(new_score), 2),
            }
        )
        # Keep only recent history to avoid unbounded growth.
        user.topic_activity[concept] = history[-50:]
        
    await user.save()
    print(f"[{user.name}] Updated profile: {user.knowledge_profile}")
