import cv2
import numpy as np
from io import BytesIO

class ImageSimilarity:
    def __init__(self):
        self.feature_extractor = cv2.BRISK_create()
    
    def calculate_similarity(self, image_file1, image_file2):
        image1 = cv2.imdecode(np.frombuffer(image_file1.read(), np.uint8), cv2.IMREAD_GRAYSCALE)
        image2 = cv2.imdecode(np.frombuffer(image_file2.read(), np.uint8), cv2.IMREAD_GRAYSCALE)
        
        keypoints1, descriptors1 = self.feature_extractor.detectAndCompute(image1, None)
        keypoints2, descriptors2 = self.feature_extractor.detectAndCompute(image2, None)
        
        # Perform feature matching and calculate similarity score
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = matcher.match(descriptors1, descriptors2)
        similarity_score = len(matches)
        
        # Normalize similarity score as a percentage
        max_matches = max(len(keypoints1), len(keypoints2))
        similarity_score = (similarity_score / max_matches)
        
        return similarity_score
