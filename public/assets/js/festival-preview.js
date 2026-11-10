// This payload is supplied only by the separately launched local preview server.
const festivalPreview = JSON.parse(document.getElementById('festival-preview-data').textContent);
window.startStory(festivalPreview, '축제 체험');
