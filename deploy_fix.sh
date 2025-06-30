#!/bin/bash

# Deploy fixed embeddings requirements to server
echo "Copying updated embeddings requirements.txt to server..."
scp server/services/embeddings_service/requirements.txt hopboy553@195.35.37.167:/home/hopboy553/video-call-translation_OFFICIAL/server/services/embeddings_service/requirements.txt

echo "Rebuilding embeddings service on server..."
ssh hopboy553@195.35.37.167 "cd /home/hopboy553/video-call-translation_OFFICIAL && docker-compose -f docker-compose.production.yml build --no-cache embeddings"

echo "Starting all services..."
ssh hopboy553@195.35.37.167 "cd /home/hopboy553/video-call-translation_OFFICIAL && docker-compose -f docker-compose.production.yml up -d"

echo "Checking service status..."
ssh hopboy553@195.35.37.167 "cd /home/hopboy553/video-call-translation_OFFICIAL && docker-compose -f docker-compose.production.yml ps"
