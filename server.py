# server.py
from flask import Flask, request, Response
from flask_cors import CORS
from mistral import generate_attack_with_mistral

app = Flask(__name__)
CORS(app)

@app.route('/api/attack', methods=['POST'])
def get_attack():
    try:
        user_request = request.json.get('user_request')
        attack_code = generate_attack_with_mistral(user_request)
        return Response(attack_code, mimetype='text/plain')
    except Exception as e:
        return Response(str(e), status=500, mimetype='text/plain')

if __name__ == '__main__':
    app.run(port=5000, debug=True)
