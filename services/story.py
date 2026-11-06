"""더뉴빌리지의 고정 사건과 공개 가능한 화면 상태."""

from copy import deepcopy


START_SCORE = 50
JOB_THRESHOLD = 70
WELCOME_SCORE = 70
WARY_SCORE = 35
CHAT_DELTAS = {"friendly": 5, "cooperative": 7, "neutral": 0, "hostile": -2}
MAX_HOSTILE_CHATS_PER_SCENE = 3
CHARACTERS = {"jimmy": "지미", "karen": "캐런", "bob": "밥", "cathy": "캐시"}
LOCATIONS = {
    "player_house": "새집",
    "karen_house": "캐런의 집",
    "butcher_shop": "정육점",
    "salon": "미용실",
    "square": "마을 광장",
    "basement": "정육점 지하실",
}

# Each entry contains only facts available to the current conversation partner at this point.
SCENE_CONTEXT = {
    "arrival": ("플레이어가 새집에 이사 왔고 지미가 마을을 소개했다.", "지미는 한 달 먼저 이사 온 주민이다.", "이후 사건을 미리 말하지 않는다."),
    "cathy_task": ("지미가 캐시의 일손이 부족해 보인다고 말하며 도움을 권했다.", "지미는 캐시가 왜 바쁜지나 구체적으로 무슨 일을 하는지 모른다.", "모르는 업무 내용을 지어내지 않는다."),
    "cathy_help": ("캐시가 미용실에서 도움을 부탁했다.", "캐시는 미용실에 일손이 필요하다. 구체적인 업무는 아직 정해지지 않았다.", "업무나 새로운 사건을 구체적으로 지어내지 않는다."),
    "jimmy_butcher": ("캐시를 돕고 집에 돌아오자 지미가 잠깐 정육점에 다녀오겠다고 직접 말했다.", "지미는 아직 정육점 지하실에서 무슨 일이 일어날지 모른다.", "이후 정육점 사건이나 마을의 비밀을 미리 밝히지 않는다."),
    "karen_search": ("지미가 정육점에 가겠다며 떠난 뒤 캐런이 집에 찾아와 지미를 봤는지 물었다.", "캐런은 지미가 정육점으로 향한 것을 확인하지 못했다.", "지미에게 일어날 일이나 정육점의 비밀을 미리 밝히지 않는다."),
    "butcher_search": ("정육점에서 지미의 사색이 된 얼굴을 보았다. 플레이어는 이유를 모른다.", "지미는 정육점 지하실에서 무언가를 발견해 마을의 사이비 의식과 식인의 비밀을 모두 알게 됐다. 두려워서 지금은 털어놓지 못한다.", "비밀의 내용이나 지미가 본 구체적인 물건을 플레이어에게 밝히지 않는다."),
    "bob_caught": ("플레이어는 지하실의 수첩에서 지미의 이름과 축제 준비 날짜를 보고 올라왔다. 밥이 그곳에 들어온 플레이어를 발견했다.", "밥은 플레이어가 지하실에 들어간 것을 안다. 플레이어가 비밀 전체를 안다고 단정할 수 없다.", "수첩만으로 알 수 없는 음식의 정체를 밝히지 않는다."),
    "dinner_invite": ("지미가 캐런의 다음 날 저녁 식사 초대를 전하며 함께 가자고 했다. 다음 날 오후 6시에 플레이어의 집으로 데리러 오겠다고 약속했다. 플레이어는 수첩의 이름과 날짜만 알고 있다.", "지미는 앞서 정육점 지하실에서 마을의 사이비 의식과 식인의 비밀을 알게 됐다. 두려워서 아직 직접 밝히지 못한다.", "비밀 전체나 이후 사건을 미리 밝히지 않는다."),
    "karen_dinner": ("다음 날 오후 6시에 데리러 오겠다던 지미가 오후 7시까지 나타나지 않아 플레이어가 혼자 캐런의 집에 왔다.", "캐런은 지미가 오지 않은 사실을 안다. 이유는 확인되지 않았다.", "지미의 행방을 확정해서 말하거나 이후 사진 발견을 미리 언급하지 않는다."),
    "photo_found": ("플레이어가 캐런 집의 수상한 방에서 지미의 사진을 발견했고 캐런에게 들켰다.", "캐런은 플레이어가 자기 방에 들어와 사진을 본 것을 안다.", "지미의 운명이나 축제 음식의 정체를 밝히지 않는다."),
    "checkpoint": ("플레이어가 사진을 본 뒤 집에 돌아왔다. 캐런이 유통 운전 일을 제안했다.", "캐런은 이미 일자리 제안 여부를 정했다.", "차 키를 받기 전부터 가지고 있다고 말하거나 축제의 비밀을 밝히지 않는다."),
    "festival_invite": ("밥이 초대한 날의 다음 날 열리는 마을 축제에 플레이어를 초대했다.", "밥은 축제 음식을 담당한다.", "음식의 재료나 축제에서 벌어질 일을 미리 밝히지 않는다."),
    "festival": ("밥이 초대한 다음 날, 플레이어가 광장에 차려진 축제 음식 앞에 있다.", "밥은 축제 음식을 담당한다.", "플레이어가 아직 발견하지 않은 음식의 정체를 밝히지 않는다."),
    "hair_found": ("플레이어가 축제 음식에서 금발 머리카락을 발견하고, 대머리인 밥·금발인 지미의 실종·지하실 수첩을 연결해 음식의 정체를 추리했다.", "밥은 플레이어가 머리카락을 발견한 상황을 볼 수 있다.", "플레이어 대신 다음 행동이나 결말을 결정하지 않는다."),
}


def scene_context(state: dict) -> tuple[str, str, str]:
    if state["scene_id"] == "checkpoint" and state.get("job_offered") is False:
        return ("플레이어가 사진을 본 뒤 집에 돌아왔고 캐런이 정육점으로 오라고 불렀다.",
                "캐런은 이미 정육점으로 부르기로 정했다.", "정육점에서 일어날 일이나 축제의 비밀을 미리 밝히지 않는다.")
    if state["scene_id"] == "neighbors":
        return ("플레이어가 이웃의 장소를 방문했다.",
                "현재 대화 상대는 이 장소에서 플레이어를 만난다.", "이후 사건을 미리 말하지 않는다.")
    return SCENE_CONTEXT.get(state["scene_id"], ("현재 장면에서 플레이어와 대화 중이다.", "현재 공개된 사실만 안다.", "이후 사건을 미리 말하지 않는다."))


def event(speaker_id: str, text: str, image: str | None = None) -> dict:
    return {"speaker_id": speaker_id, "text": text, "image": image}


def new_state(player_name: str) -> dict:
    return {
        "version": 1,
        "player_name": player_name,
        "scene_id": "arrival",
        "location_id": "player_house",
        "visited": [],
        "clues": [],
        "journal": [],
        "affinity": START_SCORE,
        "scored_chat": [],
        "scored_messages": [],
        "positive_scores": {},
        "hostile_streak": 0,
        "has_car_key": False,
        "job_offered": None,
        "ending": None,
        "history": {},
        "scene_events": [],
    }


def _action(action_id: str, label: str, kind: str) -> dict:
    return {"id": action_id, "label": label, "kind": kind}


def adjusted_affinity(score: int, base_delta: int) -> int:
    modifier = (100 - score) / (100 - START_SCORE) if base_delta > 0 and score > START_SCORE else 1
    return max(0, min(100, score + round(base_delta * modifier)))


def available_characters(state: dict) -> list[str]:
    scene = state["scene_id"]
    if scene in {"arrival", "cathy_task", "jimmy_butcher", "dinner_invite"}:
        return ["jimmy"]
    if scene == "karen_search":
        return ["karen"]
    if scene == "neighbors":
        return {
            "karen_house": ["karen"],
            "butcher_shop": ["bob"],
            "salon": ["cathy"],
        }.get(state["location_id"], [])
    if scene == "cathy_help":
        return ["cathy"]
    if scene == "butcher_search":
        return ["jimmy"]
    if scene == "bob_caught" or scene == "festival_invite":
        return ["bob"]
    if scene in {"karen_dinner", "photo_found"}:
        return ["karen"]
    if scene == "checkpoint":
        return ["karen"]
    if scene in {"festival", "hair_found"}:
        return ["bob"]
    return []


def available_actions(state: dict) -> list[dict]:
    scene = state["scene_id"]
    if scene == "arrival":
        return [_action("visit_neighbors", "이웃들에게 인사하러 간다", "move")]
    if scene == "neighbors":
        actions = [
            _action("visit_karen", "캐런의 집", "move"),
            _action("visit_bob", "정육점", "move"),
            _action("visit_cathy", "미용실", "move"),
        ]
        if len(state["visited"]) == 3:
            actions.append(_action("return_home", "집으로 돌아간다", "move"))
        return actions
    if scene == "cathy_task":
        return [_action("go_help_cathy", "캐시를 도우러 간다", "move")]
    if scene == "cathy_help":
        return [_action("help_cathy", "캐시의 일을 돕는다", "choice")]
    if scene == "jimmy_butcher":
        return [_action("see_jimmy_off", "지미를 배웅한다", "choice")]
    if scene == "karen_search":
        return [_action("go_butcher", "지미를 찾아 정육점으로 간다", "move")]
    if scene == "butcher_search":
        return [_action("approach_jimmy", "사색이 된 지미에게 다가간다", "inspect")]
    if scene == "empty_butcher":
        return [_action("inspect_basement", "지하실을 살핀다", "inspect")]
    if scene == "basement":
        return [_action("go_upstairs", "위층으로 올라간다", "move")]
    if scene == "bob_caught":
        return [_action("return_home", "집으로 돌아간다", "move")]
    if scene == "dinner_invite":
        return [_action("accept_dinner_invite", "내일 지미가 데리러 오기를 기다린다", "choice")]
    if scene == "wait_dinner":
        return [_action("go_karen_dinner", "혼자 캐런의 집으로 간다", "move")]
    if scene == "karen_dinner":
        return [_action("inspect_room", "수상한 방을 살핀다", "inspect")]
    if scene == "photo_found":
        return [_action("return_home", "집으로 돌아간다", "move")]
    if scene == "checkpoint":
        if state.get("job_offered", state["affinity"] >= JOB_THRESHOLD):
            return [
                _action("accept_job", "유통 운전 일을 수락한다", "choice"),
                _action("decline_job", "일자리를 거절한다", "choice"),
            ]
        return [_action("go_butcher", "캐런을 만나러 정육점에 간다", "move")]
    if scene == "festival_invite":
        return [_action("go_festival", "마을 축제로 간다", "move")]
    if scene == "festival":
        return [_action("inspect_food", "음식을 살핀다", "inspect")]
    if scene == "hair_found":
        return [
            _action("escape", "마을에서 도망친다", "choice"),
            _action("stay", "마을에 남는다", "choice"),
        ]
    return []


def view(state: dict) -> dict:
    characters = available_characters(state)
    return {
        "scene_id": state["scene_id"],
        "location_id": state["location_id"],
        "location_name": LOCATIONS[state["location_id"]],
        "background": f"/assets/images/{state['location_id']}.svg",
        "available_characters": [
            {
                "id": character_id,
                "name": CHARACTERS[character_id],
                "portrait": f"/assets/images/{character_id}_neutral.svg",
            }
            for character_id in characters
        ],
        "available_actions": available_actions(state),
        "affinity": state["affinity"],
        "journal": state["journal"],
        "ending": state["ending"],
    }


def apply_action(state: dict, action_id: str) -> tuple[dict, list[dict]]:
    """현재 표시된 행동만 한 번 실행하고 다음 상태와 사건을 반환한다."""
    if action_id not in {item["id"] for item in available_actions(state)}:
        raise ValueError("invalid_action")
    next_state = deepcopy(state)
    scene = state["scene_id"]
    events = []

    if scene == "arrival":
        next_state.update(scene_id="neighbors", location_id="square")
        events.append(event("thought", "지미의 권유대로 광장에 나왔다. 캐런, 밥, 캐시에게 차례로 인사해 보자."))
    elif scene == "neighbors":
        destination = {
            "visit_karen": ("karen_house", "karen"),
            "visit_bob": ("butcher_shop", "bob"),
            "visit_cathy": ("salon", "cathy"),
        }.get(action_id)
        if destination:
            next_state["location_id"] = destination[0]
            first_visit = destination[1] not in next_state["visited"]
            if first_visit:
                next_state["visited"].append(destination[1])
            greetings = ({
                "karen": "어서 오세요. 마을 이야기는 조금씩 알게 되실 거예요.",
                "bob": "새 손님이군. 가게에서는 구경만 하시오.",
                "cathy": "반가워요. 다들 새 이웃을 유심히 보고 있답니다.",
            } if next_state["affinity"] < WARY_SCORE else {
                "karen": "어서 오세요. 마을이 낯설진 않으신가요?",
                "bob": "어서 오시오. 필요한 게 있으면 말하쇼.",
                "cathy": "반가워요. 미용실에도 편히 들러 주세요.",
            } if next_state["affinity"] < WELCOME_SCORE else {
                "karen": "어머, 새로 오신 분이군요. 우리 마을은 모두 가족 같답니다.",
                "bob": "고기 좋아하쇼? 마을 축제 때 꼭 들르시게.",
                "cathy": "반가워요. 시간이 되면 미용실에도 들러 주세요.",
            })
            if first_visit:
                events.append(event(destination[1], greetings[destination[1]]))
        else:
            next_state.update(scene_id="cathy_task", location_id="player_house")
            events.append(event("jimmy", "캐시가 바빠 보이더라. 도와줄 사람이 필요한 것 같던데, 미용실로 가볼래?"))
    elif scene == "cathy_task":
        next_state.update(scene_id="cathy_help", location_id="salon")
        events.append(event("cathy", "잘 오셨어요. 이 일을 좀 도와주시겠어요?"))
    elif scene == "cathy_help":
        next_state.update(scene_id="jimmy_butcher", location_id="player_house")
        next_state["affinity"] = min(100, next_state["affinity"] + 5)
        events += [
            event("thought", "캐시를 돕고 집에 돌아왔다. 캐시는 끝까지 내 반응을 살피는 듯했다."),
            event("jimmy", "나 잠깐 정육점에 다녀올게."),
        ]
    elif scene == "jimmy_butcher":
        next_state["scene_id"] = "karen_search"
        events += [event("thought", "지미가 떠난 뒤 캐런이 집으로 찾아왔다."), event("karen", "혹시 지미를 보셨나요?")]
    elif scene == "karen_search":
        next_state.update(scene_id="butcher_search", location_id="butcher_shop")
        events.append(event("thought", "정육점에 도착하니 지미의 얼굴이 사색이 되어 있었다."))
    elif scene == "butcher_search":
        next_state["scene_id"] = "empty_butcher"
        events.append(event("jimmy", "지금은 말할 수 없어. 나중에 보자.", "/assets/images/jimmy_worried.svg"))
    elif scene == "empty_butcher":
        next_state.update(scene_id="basement", location_id="basement")
        next_state["clues"].append("notebook")
        next_state["journal"].append("지하실의 수첩에 지미의 이름과 축제 준비 날짜가 함께 적혀 있었다.")
        next_state["affinity"] = max(0, next_state["affinity"] - 5)
        events.append(event("thought", "수첩에는 지미의 이름이 있었다. 음식의 정체까지는 알 수 없었다."))
    elif scene == "basement":
        next_state.update(scene_id="bob_caught", location_id="butcher_shop")
        events.append(event("bob", "거기서 뭐 하시오? 여긴 손님이 들어올 곳이 아니야."))
    elif scene == "bob_caught":
        next_state.update(scene_id="dinner_invite", location_id="player_house")
        events.append(event("jimmy", "캐런이 내일 저녁 식사에 초대했어. 같이 가자. 내일 6시에 네 집으로 데리러 올게."))
    elif scene == "dinner_invite":
        next_state["scene_id"] = "wait_dinner"
        events.append(event("thought", "다음 날 오후 7시가 되도록 지미는 나타나지 않았다. "))
    elif scene == "wait_dinner":
        next_state.update(scene_id="karen_dinner", location_id="karen_house")
        events.append(event("karen", "어서 오세요. 아직 준비할게 조금 남아서, 잠깐 앉아서 쉬고 계세요. "))
    elif scene == "karen_dinner":
        next_state["scene_id"] = "photo_found"
        next_state["clues"].append("jimmy_photo")
        next_state["journal"].append("캐런의 수상한 방에서 지미의 사진을 발견했다.")
        next_state["affinity"] = max(0, next_state["affinity"] - 5)
        events += [
            event("thought", "벽에 지미의 사진이 걸려 있었다."),
            event("karen", "제 방에서 무엇을 보고 계신 거죠?", "/assets/images/karen_worried.svg"),
        ]
    elif scene == "photo_found":
        next_state.update(scene_id="checkpoint", location_id="player_house")
        next_state["job_offered"] = next_state["affinity"] >= JOB_THRESHOLD
        if next_state["job_offered"]:
            events.append(event("karen", "내일부터 함께 일하지 않을래요? 유통 운전 일을 해줄 사람이 필요하거든요. "))
        else:
            events.append(event("karen", "정육점으로 와 주시겠어요?"))
    elif scene == "checkpoint":
        if action_id == "go_butcher":
            next_state.update(scene_id="ending", location_id="butcher_shop", ending="death")
            death = "캐런의 부름을 따라 정육점에 들어서자 이웃들이 출구를 막았다. 그곳에서 목숨을 잃었다."
            next_state["journal"].append(death)
            events.append(event("narrator", death, "/assets/images/ending_death.svg"))
            return next_state, events
        next_state["scene_id"] = "festival_invite"
        if action_id == "accept_job":
            next_state["has_car_key"] = True
            next_state["journal"].append("캐런의 유통 운전 일을 받아 차 키를 얻었다.")
            events.append(event("karen", "잘 생각하셨어요. 이제 우리와 함께 일하게 됐군요."))
        elif action_id == "decline_job":
            events.append(event("karen", "아쉽지만 괜찮아요. 축제에는 꼭 오세요."))
        events.append(event("bob", "고기 좋아한다고 했지? 내일 마을 축제가 있으니, 꼭 오시오."))
    elif scene == "festival_invite":
        next_state.update(scene_id="festival", location_id="square")
        events.append(event("narrator", "광장에 축제 음식이 차려졌다. 주민들이 자리에 앉기를 권한다."))
    elif scene == "festival":
        next_state["scene_id"] = "hair_found"
        next_state["clues"].append("jimmy_hair")
        next_state["journal"].append("축제 음식에서 금발인 지미의 머리카락을 발견했다.")
        events += [
            event("thought", "음식에서 금발 머리카락을 발견했다. 음식을 만든 밥은 대머리다."),
            event("thought", "금발의 지미는 사라졌고, 지하실 수첩에는 그의 이름과 축제 준비 날짜가 함께 적혀 있었다. 그제야 음식의 정체가 떠올랐다."),
        ]
    elif scene == "hair_found":
        ending = "assimilation" if action_id == "stay" else "escape" if state["has_car_key"] else "death"
        next_state.update(scene_id="ending", ending=ending)
        endings = {
            "escape": "차 키를 움켜쥐고 마을 경계를 빠져나왔다. 더뉴빌리지는 뒤로 멀어졌다.",
            "death": "차가 없었다. 이웃들이 길을 막았고, 곧 지미의 사진 옆에 내 사진이 걸렸다.",
            "assimilation": "새 이웃이 도착했다. 나는 캐런처럼 웃으며 말했다. ‘더뉴빌리지에 오신 걸 환영해요.’",
        }
        next_state["journal"].append(endings[ending])
        events.append(event("narrator", endings[ending], f"/assets/images/ending_{ending}.svg"))

    return next_state, events
