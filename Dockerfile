FROM nginx:alpine
# Copy static assets (HTML/CSS/JS)
COPY . /usr/share/nginx/html
# Cloud Run expects the container to listen on $PORT (default 8080)
EXPOSE 8080
# Patch default nginx server block to listen on 8080 instead of 80
CMD sh -c "sed -i 's/listen       80;/listen 8080;/' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"