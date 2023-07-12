from flask import Flask, request, jsonify
from text_similarity import TextSimilarity
from image_similarity import ImageSimilarity

app = Flask(__name__)

text_similarity = TextSimilarity()
image_similarity = ImageSimilarity()

@app.route('/text_similarity', methods=['POST'])
def calculate_text_similarity():
    data = request.get_json()
    text1 = data['text1']
    text2 = data['text2']
    
    similarity_score = text_similarity.calculate_similarity(text1, text2)
    
    response = {
        'similarity_score': similarity_score
    }
    return jsonify(response)

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
    app.run()
