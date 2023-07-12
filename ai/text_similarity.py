from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer,util

class TextSimilarity:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained("uer/sbert-base-chinese-nli")
        self.model = SentenceTransformer("uer/sbert-base-chinese-nli")
    
    def calculate_similarity(self, text1, text2):
        embedding_1= self.model.encode(text1, convert_to_tensor=True)
        embedding_2 = self.model.encode(text2, convert_to_tensor=True)
        return util.pytorch_cos_sim(embedding_1, embedding_2)[0].item()
