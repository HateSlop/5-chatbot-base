"""더뉴빌리지의 고정 사건과 공개 가능한 화면 상태."""

from calendar import monthrange
from copy import deepcopy
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import time


START_SCORE = 50
JOB_THRESHOLD = 65
WELCOME_SCORE = 70
WARY_SCORE = 35
CHAT_DELTAS = {"friendly": 5, "cooperative": 7, "neutral": 0, "hostile": -2}
MAX_HOSTILE_CHATS_PER_SCENE = 3
CHARACTERS = {"jimmy": "지미", "karen": "캐런", "bob": "밥", "cathy": "캐시"}
CATHY_TOOLS = {
    "shampoo": "샴푸", "scissors": "가위", "conditioner": "린스", "comb": "빗",
    "spray": "스프레이", "serum": "헤어 오일", "brush": "브러시", "mirror": "손거울",
    "towel": "수건", "roller": "헤어롤",
}
CATHY_REQUEST = {"shampoo", "scissors", "comb"}
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
    "arrival": ("플레이어가 새집에 이사 왔고 지미가 마을을 소개하며 친구 찰스가 지난주 마을을 떠났다고 말했다.", "지미는 한 달 먼저 이사 온 주민이다. 찰스는 지미의 친구이며, 지미는 그가 지난주 마을을 떠난 것으로 안다.", "찰스가 떠난 이유나 행선지는 모르므로 지어내지 않는다. 이후 사건을 미리 말하지 않는다."),
    "cathy_task": ("지미가 캐시의 일손이 부족해 보인다고 말하며 도움을 권했다.", "지미는 캐시가 왜 바쁜지나 구체적으로 무슨 일을 하는지 모른다.", "모르는 업무 내용을 지어내지 않는다."),
    "cathy_help": ("캐시가 샴푸, 가위, 빗을 바구니에서 가져다 달라고 부탁했다.", "캐시는 도구를 기다린다.", "이후 사건을 미리 말하지 않는다."),
    "jimmy_butcher": ("캐시를 돕고 집에 돌아오자 지미가 고기를 사러 정육점에 다녀오겠다고 말했다.", "지미는 고기를 사러 간다. 아직 지하실의 비밀을 모른다.", "미래 사건을 암시하거나 이유를 물은 플레이어에게 걱정하지 말라고 하지 않는다."),
    "karen_search": ("지미가 집을 떠난 뒤 캐런이 전할 말이 있어 그를 찾아달라고 부탁했다.", "캐런은 지미의 행선지를 아직 모른다. 플레이어가 알려주기 전에는 정육점을 먼저 언급하지 않는다.", "지미가 어디에 도착했는지, 그곳에서 무슨 일을 겪었는지 캐런도 모른다. 미래 사건을 밝히지 않는다."),
    "butcher_search": ("정육점에서 지미의 사색이 된 얼굴을 보았다. 플레이어는 이유를 모른다.", "지미는 정육점 지하실에서 무언가를 발견해 마을의 사이비 의식과 식인의 비밀을 모두 알게 됐다. 두려워서 지금은 털어놓지 못한다.", "비밀의 내용이나 지미가 본 구체적인 물건을 플레이어에게 밝히지 않는다."),
    "bob_caught": ("플레이어는 지하실 화로에서 타다 남은 여러 사람의 생활 소품을 보고 올라왔다. 밥이 지하실에 들어온 플레이어를 발견했다.", "밥은 플레이어가 지하실에 들어간 것을 안다. 무엇을 봤는지는 모른다.", "소지품 주인의 신원이나 음식의 정체를 밝히지 않는다."),
    "dinner_invite": ("지미가 캐런의 다음 날 저녁 식사 초대를 전하며 함께 가자고 했다. 다음 날 오후 6시에 플레이어의 집으로 데리러 오겠다고 약속했다. 플레이어는 지하실의 불탄 소지품만 보았고 주인을 모른다.", "지미는 앞서 정육점 지하실에서 마을의 사이비 의식과 식인의 비밀을 알게 됐다. 두려워서 아직 직접 밝히지 못한다.", "비밀 전체나 이후 사건을 미리 밝히지 않는다."),
    "karen_dinner": ("다음 날 오후 6시에 데리러 오겠다던 지미가 오후 7시까지 나타나지 않아 플레이어가 혼자 캐런의 집에 왔다.", "캐런은 지미가 오지 않은 사실을 안다. 이유는 확인되지 않았다.", "지미의 행방을 확정해서 말하거나 이후 사진 발견을 미리 언급하지 않는다."),
    "photo_found": ("플레이어가 캐런 집의 수상한 방에서 지미의 사진을 발견했고 캐런에게 들켰다.", "캐런은 플레이어가 자기 방에 들어와 사진을 본 것을 안다.", "지미의 운명이나 축제 음식의 정체를 밝히지 않는다."),
    "checkpoint": ("플레이어가 사진을 본 뒤 집에 돌아왔다. 캐런이 마을 일을 맡아보라고 권했다.", "캐런은 이미 일자리 제안 여부를 정했다.", "차 키를 받기 전부터 가지고 있다고 말하거나 축제의 비밀을 밝히지 않는다."),
    "job_choice": ("플레이어가 일자리를 알아보기로 했다. 캐런이 정원사와 유통 트럭 운전수 일을 설명했다.", "정원사는 마을 정원을 가꾸고 트럭 운전수는 필요한 물건을 운반한다. 아직 직업을 선택하지 않았다.", "차 키를 이미 받았다고 하거나 이후 사건을 밝히지 않는다."),
    "festival_invite": ("밥이 초대한 날의 다음 날 열리는 마을 축제에 플레이어를 초대했다.", "밥은 축제 음식을 담당한다.", "음식의 재료나 축제에서 벌어질 일을 미리 밝히지 않는다."),
    "festival": ("밥이 초대한 다음 날, 플레이어가 광장에 차려진 축제 음식 앞에 있다.", "밥은 축제 음식을 담당한다.", "플레이어가 아직 발견하지 않은 음식의 정체를 밝히지 않는다."),
    "hair_found": ("플레이어가 축제 음식에서 주황빛 적갈색 머리카락을 발견하고, 대머리인 밥·지미의 실종·지하실 화로에서 본 불탄 소지품을 연결해 음식의 정체를 추리했다.", "밥은 플레이어가 머리카락을 발견한 상황을 볼 수 있다.", "플레이어 대신 다음 행동이나 결말을 결정하지 않는다."),
}


def scene_context(state: dict, just_told_destination: bool = False) -> tuple[str, str, str]:
    if state["scene_id"] == "karen_search" and state.get("jimmy_destination_told"):
        known = ("캐런은 방금 플레이어에게 지미가 정육점에 간다고 했다는 말을 처음 들었다. "
                 "알려줘서 고맙다고 하고 정육점 쪽에서 찾아봐 달라고 부탁한다."
                 if just_told_destination else
                 "캐런은 플레이어에게 지미가 정육점에 간다는 말을 들었다. 그쪽에서 찾아봐 달라고 부탁했다.")
        observed, _, withheld = SCENE_CONTEXT["karen_search"]
        return observed, known, withheld
    if state["scene_id"] == "checkpoint" and state.get("job_offered") is False:
        return ("플레이어가 사진을 본 뒤 집에 돌아왔고 캐런이 정육점으로 오라고 불렀다.",
                "캐런은 이미 정육점으로 부르기로 정했다.", "정육점에서 일어날 일이나 축제의 비밀을 미리 밝히지 않는다.")
    if state["scene_id"] == "neighbors":
        return ("플레이어가 이웃의 장소를 방문했다.",
                "현재 대화 상대는 이 장소에서 플레이어를 만난다.", "이후 사건을 미리 말하지 않는다.")
    return SCENE_CONTEXT.get(state["scene_id"], ("현재 장면에서 플레이어와 대화 중이다.", "현재 공개된 사실만 안다.", "이후 사건을 미리 말하지 않는다."))


def event(speaker_id: str, text: str, image: str | None = None) -> dict:
    return {"speaker_id": speaker_id, "text": text, "image": image}


def story_date(state: dict) -> date:
    return date.fromisoformat(state["start_date"]) + timedelta(days=state["story_day"])


def display_date(day: date) -> str:
    return f"{day.year}.{day.month}.{day.day}"


def new_state(player_name: str, gender: str) -> dict:
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    return {
        "version": 1,
        "player_name": player_name,
        "gender": gender,
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
        "job": None,
        "ending": None,
        "history": {},
        "scene_events": [],
        "cathy_tools": [],
        "photo_recognized": False,
        "jimmy_destination_told": False,
        "start_date": date(1955, today.month, min(today.day, monthrange(1955, today.month)[1])).isoformat(),
        "story_day": 0,
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
    if scene == "butcher_search":
        return ["jimmy"]
    if scene == "festival_invite":
        return ["bob"]
    if scene == "karen_dinner":
        return []
    if scene in {"checkpoint", "job_choice"}:
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
            _action("visit_karen", "캐런의 집에 가본다", "move"),
            _action("visit_bob", "정육점에 가본다", "move"),
            _action("visit_cathy", "미용실에 가본다", "move"),
        ]
        if len(state["visited"]) == 3:
            actions.append(_action("return_home", "집으로 돌아간다", "move"))
        return actions
    if scene == "cathy_task":
        return [_action("go_help_cathy", "캐시를 도우러 간다", "move")]
    if scene == "cathy_help":
        return [_action(f"choose_{tool}", f"{name} 선택", "choice") for tool, name in CATHY_TOOLS.items()] + [
            _action("help_cathy", "캐시에게 전달한다", "choice")]
    if scene == "cathy_result":
        return [_action("return_home", "집으로 돌아간다", "move")]
    if scene == "jimmy_butcher":
        return [_action("see_jimmy_off", "지미를 배웅한다", "choice")]
    if scene == "karen_search":
        return [_action("go_butcher", "지미를 찾아 정육점으로 간다", "move")]
    if scene == "butcher_search":
        return [_action("approach_jimmy", "사색이 된 지미에게 다가간다", "inspect")]
    if scene == "empty_butcher":
        return [_action("inspect_basement", "지하실을 살핀다", "inspect")]
    if scene == "basement_entry":
        return [_action("descend_stairs", "계단을 내려간다", "move")]
    if scene == "basement":
        actions = ([_action("go_upstairs", "지하실에서 나온다", "move")] if "wallet_photo" in state["clues"]
                   else [])
        actions.append(_action("inspect_wallet", "지갑을 살핀다", "inspect"))
        if "wallet_found" in state["clues"]:
            actions.append(_action("open_wallet", "지갑을 연다", "inspect"))
        if "wallet_open" in state["clues"]:
            actions.append(_action("inspect_wallet_photo", "지갑 속 사진을 살핀다", "inspect"))
        return actions
    if scene == "bob_caught":
        return [_action("return_home", "집으로 돌아간다", "move")]
    if scene == "dinner_invite":
        return [_action("accept_dinner_invite", "내일 지미가 데리러 오기를 기다린다", "choice")]
    if scene == "wait_dinner":
        return [_action("go_karen_dinner", "혼자 캐런의 집으로 간다", "move")]
    if scene == "karen_dinner":
        return [_action("inspect_room", "수상한 방을 살핀다", "inspect")]
    if scene == "photo_found":
        if state.get("photo_recognized"):
            return [_action("return_home", "집으로 돌아간다", "move")]
        actions = []
        if "photo_back_date" not in state["clues"]:
            actions.append(_action("inspect_photo_back", "지미 액자 뒷면을 확인한다", "inspect"))
        elif "jimmy_photo" not in state["clues"]:
            actions.append(_action("recognize_photo", "지미 액자 조사를 마친다", "inspect"))
        actions.append(_action("inspect_charles_photo", "옆 액자를 살핀다", "inspect"))
        if "charles_photo_front" in state["clues"] and "charles_photo_back" not in state["clues"]:
            actions.append(_action("inspect_charles_photo_back", "옆 액자 뒷면을 확인한다", "inspect"))
        elif "charles_photo_back" in state["clues"] and "charles_photo" not in state["clues"]:
            actions.append(_action("recognize_charles_photo", "찰스 액자 조사를 마친다", "inspect"))
        return actions
    if scene == "checkpoint":
        if state.get("job_offered", state["affinity"] >= JOB_THRESHOLD):
            return [
                _action("accept_job", "일자리를 알아본다", "choice"),
                _action("decline_job", "지금은 거절한다", "choice"),
            ]
        return [_action("go_butcher", "캐런을 만나러 정육점에 간다", "move")]
    if scene == "job_choice":
        return [_action("choose_gardener", "정원사", "choice"),
                _action("choose_driver", "트럭 운전수", "choice")]
    if scene == "job_result":
        return [_action("see_karen_off", "캐런을 배웅한다", "choice")]
    if scene == "festival_invite":
        return [_action("go_festival", "마을 축제로 간다", "move")]
    if scene == "festival":
        return [_action("inspect_food", "축제 음식을 살펴본다", "inspect")]
    if scene == "hair_found":
        return [_action("begin_final_choice", "결정의 순간", "choice")]
    if scene == "final_choice":
        return [
            _action("escape", "도망친다", "choice"),
            _action("stay", "모른척 참고 먹는다", "choice"),
            _action("choice_timeout", "선택 시간 종료", "choice"),
        ]
    if scene == "truck_escape":
        if state.get("truck_deadline") is None:
            return [_action("begin_truck_escape", "차문을 향해 달려간다", "choice")]
        return [_action("open_truck_door", "트럭 차문을 연다", "inspect"),
                _action("truck_timeout", "추격 시간 종료", "choice")]
    if scene == "truck_escape_result":
        return [_action("finish_truck_escape", "결말로 이어간다", "choice")]
    return []


def view(state: dict) -> dict:
    characters = available_characters(state)
    return {
        "scene_id": state["scene_id"],
        "location_id": state["location_id"],
        "location_name": ("트럭 앞" if state["scene_id"] in {"truck_escape", "truck_escape_result"}
                          else LOCATIONS[state["location_id"]]),
        "background": ("/assets/images/ending_truck.png" if state["scene_id"] in {"truck_escape", "truck_escape_result"}
                       else "/assets/images/basement_wallet.png" if state["scene_id"] == "basement"
                       else f"/assets/images/{state['location_id']}.svg"),
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
        "gender": state.get("gender"),
        "job": state.get("job"),
        "journal": state["journal"],
        "today": display_date(story_date(state)),
        "photo_back_date": (display_date(story_date(state) - timedelta(days=1))
                            if state["scene_id"] == "photo_found" and "photo_back_date" in state["clues"] else None),
        "ending": state["ending"],
        "choice_deadline": state.get("choice_deadline") if state["scene_id"] == "final_choice" else None,
        "truck_deadline": state.get("truck_deadline") if state["scene_id"] == "truck_escape" else None,
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
            next_state["story_day"] = 1
            events.append(event("jimmy", "캐시가 바빠 보이더라. 도와줄 사람이 필요한 것 같던데, 미용실로 가볼래?"))
    elif scene == "cathy_task":
        next_state.update(scene_id="cathy_help", location_id="salon")
        next_state["cathy_tools"] = []
        events.append(event("cathy", "지금 너무 바쁘니까 바구니에서 물건 좀 꺼내와줄래요?"))
        events.append(event("cathy", "바구니에서 샴푸, 가위, 빗 좀 가져다줄래요?"))
    elif scene == "cathy_help":
        if action_id.startswith("choose_"):
            tool = action_id.removeprefix("choose_")
            selected = next_state["cathy_tools"]
            if tool in selected:
                selected.remove(tool)
            else:
                selected.append(tool)
        else:
            correct = set(next_state["cathy_tools"]) == CATHY_REQUEST
            next_state["scene_id"] = "cathy_result"
            if correct:
                next_state["affinity"] = min(100, next_state["affinity"] + 5)
                events.append(event("cathy", "정확해요! 덕분에 한숨 돌리겠네요. 고마워요."))
            else:
                events.append(event("cathy", "그냥 내가 할게요. 집에 가세요."))
    elif scene == "cathy_result":
        next_state.update(scene_id="jimmy_butcher", location_id="player_house")
        next_state["story_day"] = 2
        events += [
            event("thought", "미용실을 나와 집으로 돌아왔다. 캐시는 끝까지 내 반응을 살피는 듯했다."),
            event("jimmy", "고기 좀 사러 정육점에 다녀올게."),
        ]
    elif scene == "jimmy_butcher":
        next_state["scene_id"] = "karen_search"
        events += [event("thought", "지미가 떠난 뒤 캐런이 집으로 찾아왔다."), event("karen", "지미에게 전할 말이 있는데, 혹시 어디로 갔는지 아세요? 찾는 걸 도와주시겠어요?")]
    elif scene == "karen_search":
        next_state.update(scene_id="butcher_search", location_id="butcher_shop")
        events.append(event("jimmy", "...", "/assets/images/jimmy_scared.png"))
    elif scene == "butcher_search":
        next_state["scene_id"] = "empty_butcher"
        events.append(event("thought", "(지미가 급하게 나갔다)"))
    elif scene == "empty_butcher":
        next_state.update(scene_id="basement_entry", location_id="basement")
        events.append(event("thought", "뭐가 엄청 어질러져 있네.. 내려가 볼까?"))
    elif scene == "basement_entry":
        next_state["scene_id"] = "basement"
        if "brazier" not in next_state["clues"]:
            next_state["clues"].append("brazier")
            next_state["journal"].append("지하실 화로에서 여러 사람의 타다 남은 생활 소품을 보았다. 누군가 물건을 없애는 듯하다.")
    elif scene == "basement":
        if action_id == "inspect_wallet":
            if "wallet_found" not in next_state["clues"]:
                next_state["clues"].append("wallet_found")
        elif action_id == "open_wallet":
            if "wallet_open" not in next_state["clues"]:
                next_state["clues"].append("wallet_open")
        elif action_id == "inspect_wallet_photo":
            if "wallet_photo" not in next_state["clues"]:
                next_state["clues"].append("wallet_photo")
                next_state["journal"].append("지하실의 지갑에서 지미와 다른 남자가 함께 찍힌 오래된 사진을 보았다.")
            events.append(event("thought", "지미…랑 옆에는 누구지…?"))
        elif action_id == "go_upstairs":
            next_state.update(scene_id="bob_caught", location_id="butcher_shop")
            next_state["affinity"] = max(0, next_state["affinity"] - 5)
            events.append(event("bob", "거기서 뭐 하시오? 여긴 손님이 들어올 곳이 아니야. 당장 나가시오."))
    elif scene == "bob_caught":
        next_state.update(scene_id="dinner_invite", location_id="player_house")
        events.append(event("jimmy", "캐런이 내일 저녁 식사에 초대했어. 같이 가자. 내일 오후 6시에 네 집으로 데리러 올게."))
    elif scene == "dinner_invite":
        next_state["scene_id"] = "wait_dinner"
        next_state["story_day"] = 3
        events.append(event("thought", "다음 날 오후 7시가 되도록 지미는 데리러 오지 않았다."))
    elif scene == "wait_dinner":
        next_state.update(scene_id="karen_dinner", location_id="karen_house")
        events.extend([
            event("karen", "와 주셨네요. 식사 준비가 조금 남았어요. 여기서 잠깐 기다려 주시겠어요?"),
            event("karen", "지미요..? 저도 잘 모르겠네요."),
        ])
    elif scene == "karen_dinner":
        next_state["scene_id"] = "photo_found"
    elif scene == "photo_found":
        if action_id == "inspect_photo_back":
            date_text = display_date(story_date(state) - timedelta(days=1))
            next_state["clues"].append("photo_back_date")
            next_state["journal"].append(f"캐런의 방에 있는 지미 액자 뒷면에 {date_text}이 적혀 있었다.")
            events.append(event("thought", f"액자 뒷면에 {date_text}이 적혀 있다."))
        elif action_id == "inspect_charles_photo":
            if "charles_photo_front" not in next_state["clues"]:
                next_state["clues"].append("charles_photo_front")
            events.append(event("thought", "이 사람은 어제 지갑 속 사진에 있던 사람이잖아..?"))
        elif action_id == "inspect_charles_photo_back":
            next_state["clues"].append("charles_photo_back")
            next_state["journal"].append("옆 액자 뒷면에는 Charles라는 이름이 적혀 있었다.")
            events.append(event("thought", "찰스…? 지미가 마을을 떠났다고 했던 친구잖아."))
        elif action_id == "recognize_photo":
            next_state["clues"].append("jimmy_photo")
            next_state["journal"].append("캐런의 수상한 방에서 지미의 사진을 발견했다.")
        elif action_id == "recognize_charles_photo":
            next_state["clues"].append("charles_photo")
            next_state["journal"].append("캐런의 수상한 방에서 찰스의 사진도 발견했다.")
        elif action_id == "return_home":
            next_state.update(scene_id="checkpoint", location_id="player_house")
            next_state["job_offered"] = next_state["affinity"] >= JOB_THRESHOLD
            if next_state["job_offered"]:
                events.append(event("karen", "이웃들과 잘 지내시는 것 같아 마음이 놓이네요. 이곳 생활도 이제 조금 익숙해지셨지요? 마침 여쭤보고 싶은 게 있었어요. 마을에서 작은 일 하나 맡아보시는 건 어떨까요? 저희는 각자 맡은 자리에서 서로를 돕고 있거든요. 자연스럽게 이웃들과 가까워지는 기회도 될 거예요."))
            else:
                events.append(event("karen", "정육점으로 와 주시겠어요?"))
        if not next_state["photo_recognized"] and {"jimmy_photo", "charles_photo"}.issubset(next_state["clues"]):
            next_state["photo_recognized"] = True
            next_state["affinity"] = max(0, next_state["affinity"] - 5)
            events += [
                event("karen", "제 방에서 무엇을 보고 계신 거죠?", "/assets/images/karen_worried.svg"),
                event("karen", "이제 그만 나가 주세요."),
            ]
    elif scene == "checkpoint":
        if action_id == "go_butcher":
            next_state.update(scene_id="ending", location_id="butcher_shop", ending="death")
            death = "캐런의 부름을 따라 정육점에 들어서자 이웃들이 출구를 막았다. 그곳에서 목숨을 잃었다. 조금 더 이웃들과 가까워졌더라면 달라졌을까."
            next_state["journal"].append(death)
            events.append(event("narrator", death, "/assets/images/ending_death.svg"))
            return next_state, events
        if action_id == "accept_job":
            next_state["scene_id"] = "job_choice"
            events.append(event("karen", "마음을 내주셔서 고마워요. 마침 두 군데에서 일손을 기다리고 있어요.\n\n정원사는 마을 정원을 돌보고, 트럭 운전수는 필요한 물건을 운반하는 일이에요. 어느 쪽이 더 잘 맞으실 것 같으세요?"))
        elif action_id == "decline_job":
            next_state["scene_id"] = "job_result"
            events.append(event("karen", "아직은 쉬는 시간이 더 필요하시군요. 물론이에요. 서두르실 필요는 없어요.\n\n마음이 정해지면 제게 말씀해 주세요. 이 마을에는 누구에게나 어울리는 자리가 있답니다."))
    elif scene == "job_choice":
        driver = action_id == "choose_driver"
        next_state.update(scene_id="job_result", job="driver" if driver else "gardener", has_car_key=driver)
        next_state["affinity"] = min(100, next_state["affinity"] + 5)
        next_state["journal"].append("직업 획득: 트럭 운전수" if driver else "직업 획득: 정원사")
        if driver:
            next_state["journal"].append("트럭 차 키를 얻었다.")
            text = "그럼 물건 운반을 맡아주시겠어요? 약속한 시간에 필요한 물건을 전해 주시면 돼요.\n\n오늘부터 마을의 트럭 운전수가 되신 걸 축하드려요. 맡아 주셔서 고마워요. 앞으로 잘 부탁드릴게요.\n\n여기, 트럭 차 키예요. 일하실 때 필요하니 잘 챙겨두세요. 잃어버리는 일은 없었으면 좋겠네요."
        else:
            text = "정원을 돌보는 일이 잘 맞으실 것 같았어요. 이웃들이 매일 보는 곳이니 세심하게 살펴주시면 좋겠네요.\n\n오늘부터 마을의 정원사가 되신 걸 축하드려요. 맡아 주셔서 고마워요. 앞으로 잘 부탁드릴게요."
        events.append(event("karen", text))
    elif scene == "job_result":
        next_state["scene_id"] = "festival_invite"
        events.append(event("bob", "고기 좋아한다고 했지? 내일 마을 축제가 있으니, 꼭 오시오."))
    elif scene == "festival_invite":
        next_state.update(scene_id="festival", location_id="square")
        next_state["story_day"] = 4
        events.append(event("narrator", "광장에 축제 음식이 차려졌다. 주민들이 자리에 앉기를 권한다."))
    elif scene == "festival":
        next_state["scene_id"] = "hair_found"
        next_state["clues"].append("jimmy_hair")
        next_state["journal"].append("축제 음식에서 주황빛 적갈색 머리카락을 발견했다.")
        events += [
            event("thought", "와… 이게 다 뭐야? 진짜 맛있어 보이는데?\n\n밥이 요리를 이렇게 잘하는 사람이었어? 솜씨가 대단한걸?\n\n뭐부터 먹어볼까…?\n\n…응?\n\n어…? 이게 뭐지?"),
            event("thought", "…뭐야, 이게? 머리카락…?\n잠깐만. 밥은 머리카락이 없잖아…?\n근데 이 색깔… 어디서 많이 봤는데… 지미?\n분명 지미 머리색이랑 똑같아…\n설마… 아니겠지?\n그럼 지금까지 내가 먹었던 게…"),
        ]
    elif scene == "hair_found":
        next_state.update(scene_id="final_choice", choice_deadline=int(time.time() * 1000) + 10000)
    elif scene == "final_choice":
        expired = time.time() * 1000 >= state["choice_deadline"]
        if action_id == "choice_timeout" and not expired:
            raise ValueError("invalid_action")
        if not expired and action_id == "escape":
            next_state.update(scene_id="truck_escape", truck_deadline=None, truck_escape_success=None)
            events.append(event("thought", "쫓아오는 속도가 너무 빨라… 이러다간 잡히겠어…!"))
        else:
            ending = "death" if expired else "assimilation"
            next_state.update(scene_id="ending", ending=ending)
            text = ("망설이는 사이 이웃들이 다가와 출구를 막았다. 더는 도망칠 수 없었다." if expired
                    else "(고기를 우걱우걱 먹으며) 하하.. 고기가 참 맛있네요..ㅎ")
            next_state["journal"].append(text)
            events.append(event("narrator", text, f"/assets/images/ending_{ending}.svg"))
    elif scene == "truck_escape":
        if action_id == "begin_truck_escape":
            next_state["truck_deadline"] = int(time.time() * 1000) + 10000
        else:
            expired = time.time() * 1000 >= state["truck_deadline"]
            if action_id == "truck_timeout" and not expired:
                raise ValueError("invalid_action")
            success = not expired and state.get("job") == "driver" and state["has_car_key"]
            if success or expired:
                next_state.update(scene_id="truck_escape_result", truck_escape_success=success)
            text = ("주머니 속 차 키로 열었다!" if success else "늦었어… 이웃들이 따라잡았어!" if expired
                    else "차가 잠겨 있다. 차 문이 열리지 않는다.")
            events.append(event("thought", text))
    elif scene == "truck_escape_result":
        ending = "escape" if state["truck_escape_success"] else "death"
        next_state.update(scene_id="ending", ending=ending)
        text = ("차 키를 움켜쥐고 마을 경계를 빠져나왔다. 더뉴빌리지는 뒤로 멀어졌다." if ending == "escape"
                else "이웃들이 따라잡았다. 곧 지미와 찰스의 사진 옆에 내 사진이 걸렸다.")
        next_state["journal"].append(text)
        events.append(event("narrator", text, f"/assets/images/ending_{ending}.svg"))

    return next_state, events
