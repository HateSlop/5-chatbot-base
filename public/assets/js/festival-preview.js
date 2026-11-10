// 축제 장면을 개발용으로 미리 보여 준다.
// This payload is supplied only by the separately launched local preview server.
const festivalPreview = JSON.parse(document.getElementById('festival-preview-data').textContent);
window.startStory(festivalPreview, '축제 체험');
