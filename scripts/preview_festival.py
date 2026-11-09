"""로컬 축제 시연 서버. 일반 app.py 실행·공개 배포에는 이 경로가 없다."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from flask import make_response, render_template  # noqa: E402
from app import app, bot_view, chatbot, load_config  # noqa: E402
from services.story import event, new_state  # noqa: E402


@app.get('/preview/festival')
def preview_festival():
    state = new_state('축제 체험')
    state.update(scene_id='festival', location_id='square', story_day=2,
                 affinity=70, job='driver', has_car_key=True,
                 clues=['brazier', 'jimmy_photo', 'photo_back_date'])
    state['journal'].append('트럭 운전수를 맡아 트럭 차 키를 가지고 있다.')
    data = chatbot._response(state, [event('narrator', '광장에 축제 음식이 차려졌다. 주민들이 자리에 앉기를 권한다.')])
    response = make_response(render_template('chat.html', bot=bot_view(load_config()), festival_preview=data))
    response.cache_control.no_store = True
    return response


@app.get('/preview/basement')
def preview_basement():
    state = new_state('지하실 체험')
    state.update(scene_id='empty_butcher', location_id='butcher_shop', affinity=70)
    data = chatbot._response(state, [event('thought', '(지미가 급하게 나갔다)')])
    response = make_response(render_template('chat.html', bot=bot_view(load_config()), festival_preview=data))
    response.cache_control.no_store = True
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5050')), debug=False)
