import os
from time import time
import torch
from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer, util
import base64
import concurrent


def s(txt):
    try:
        return txt.decode()
    except:
        return txt


class TextSimilarity:
    def __init__(self):
        # self.tokenizer = AutoTokenizer.from_pretrained("uer/sbert-base-chinese-nli")
        self.model = SentenceTransformer('uer/sbert-base-chinese-nli')

    tensors = {}

    def encode(self, text, id: str):
        if id in self.tensors:
            return self.tensors[id]
        else:
            tensor = self.model.encode(text, convert_to_tensor=True).to("cuda")

            torch.save(
                tensor, f'./data/text_similarity/embedding_msgid_{base64.urlsafe_b64encode(id.encode()).decode()}.pt')

            self.tensors[id] = tensor
            return tensor

    def load_embeddings(self):
        print("Loading Embeddings...")

        time_start = time()
        files = os.listdir('./data/text_similarity/')
        print(f'Listdir took {time()-time_start:.2f}s')
        time_start = time()

        def process_file(file):
            if file.startswith('embedding_msgid_'):
                id = base64.urlsafe_b64decode(file.replace(
                    'embedding_msgid_', '').replace('.pt', ''))
                doc_embedding = torch.load(f'./data/text_similarity/{file}')
                self.tensors[id] = doc_embedding.to('cuda')

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = []
            for file in files:
                future = executor.submit(process_file, file)
                futures.append(future)

            for i, future in enumerate(concurrent.futures.as_completed(futures)):
                print(f'{i}/{len(futures)} {i/len(futures)*100:.2f}%', end='\r')
                future.result()

        print(f'Loading Embeddings took {time()-time_start:.2f}s')

    def load_embedding_from_file(self, id, file):
        doc_embedding = torch.load(f'./data/text_similarity/{file}')
        self.tensors[id] = doc_embedding.to('cuda')

    def find_closest10(self, text):
        #  find closest 10 sentences of the corpus for each query sentence based on cosine similarity
        query_embedding = self.model.encode(text, convert_to_tensor=True)

        hits = util.semantic_search(query_embedding, torch.stack(
            list(self.tensors.values())), top_k=50)
        # map the hits to the origin ids
        hits = hits[0]
        keys = list(self.tensors.keys())
        hits = [{'id': s(keys[hit['corpus_id']]),
                 'score': hit['score']} for hit in hits]
        min_score = 0.86
        # filter and recalc score with minimum score min_score
        hits = [hit for hit in hits if hit['score'] > min_score]
        hits = [{'id': hit['id'], 'score': (hit['score']-min_score)/(1-min_score)}
                for hit in hits]

        print(hits)

        return hits
