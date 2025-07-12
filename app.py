from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
import os

app = Flask(__name__)
CORS(app)

# Connect to local MongoDB
client = MongoClient("mongodb://localhost:27017/chatbot")
db = client["chatbot"]
messages_collection = db["messages"]

# Save chat message
@app.route('/api/chat', methods=['POST'])
def save_chat():
    data = request.get_json()
    if not data.get("userId") or not data.get("sender") or data.get("text") is None:
        return jsonify({"error": "Missing required fields"}), 400

    message = {
        "userId": data["userId"],
        "sender": data["sender"],
        "text": data["text"],
        "file": data.get("file")  # optional
    }

    result = messages_collection.insert_one(message)
    return jsonify({"message": "Saved", "id": str(result.inserted_id)}), 201

# Load chat history
@app.route('/api/chat/<user_id>', methods=['GET'])
def get_chat(user_id):
    messages = list(messages_collection.find({"userId": user_id}))
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    return jsonify({"messages": messages})

if __name__ == '__main__':
    app.run(debug=True)
