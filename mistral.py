# mistral.py
from mistralai import Mistral

def generate_attack_with_mistral(user_request):
    client = Mistral(api_key="1VrbvoVVUY9cX0XEIWWYB0UR4K0yj5tc")
    inputs = [{"role": "user", "content": user_request}]

    response = client.beta.conversations.start(
        agent_id="ag_019cab8297cd74d2bf340000452a49a5",
        inputs=inputs,
    )

    # On extrait le contenu du premier message de sortie
    output_content = response.outputs[0].content

    # On enlève les marques de code ```javascript et ``` si présentes
    if output_content.startswith("```javascript"):
        output_content = output_content.replace("```javascript", "").replace("```", "").strip()

    return output_content
