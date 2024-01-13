from flask import Flask, request, jsonify
from text_similarity import TextSimilarity
from image_similarity import ImageSimilarity

app = Flask(__name__)

text_similarity = TextSimilarity()
text_similarity.load_embeddings()
image_similarity = ImageSimilarity()

@app.route('/text/save_text_embedding', methods=['POST'])
def save_text_embedding():
    data = request.get_json()
    text = data['text']
    ide = data['id']
    
    text_similarity.encode(text, ide)
    return "OK"

@app.route('/text/save_and_find_closest', methods=['POST'])
def save_and_find_closest():
    data = request.get_json()
    text = data['text']
    ide = data['id']
    
    text_similarity.encode(text, ide)
    return jsonify(text_similarity.find_closest10(text))

@app.route('/text/find_closest', methods=['POST'])
def find_closest():
    data = request.get_json()
    text = data['text']
    
    return jsonify(text_similarity.find_closest10(text))


@app.route('/image_similarity', methods=['POST'])
def calculate_image_similarity():
    file1 = request.files['image1']
    file2 = request.files['image2']
    
    similarity_score = image_similarity.calculate_similarity(file1, file2)
    
    response = {
        'similarity_score': similarity_score
    }
    return jsonify(response)


if __name__ == '__main__':
    app.run(port=
            5000)
