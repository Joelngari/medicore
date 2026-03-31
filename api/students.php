<?php
// ============================================================
//  api/students.php — Student records API
//  Handles: get all, save/update, get single
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once '../db.php';

$body   = getBody();
$action = $body['action'] ?? $_GET['action'] ?? 'get_all';

switch ($action) {

    // ── GET ALL STUDENTS ─────────────────────────────────────
    case 'get_all':
        $stmt = $pdo->query("SELECT * FROM edu_students ORDER BY created_at DESC");
        $rows = $stmt->fetchAll();
        $students = array_map('rowToStudent', $rows);
        respond(['success'=>true,'students'=>$students]);
        break;

    // ── SAVE / UPDATE STUDENT ────────────────────────────────
    case 'save':
        $s = $body['student'] ?? [];
        if (empty($s['id']) || empty($s['name'])) {
            respond(['success'=>false,'error'=>'Student ID and name are required.']);
        }

        // Check if exists
        $exists = $pdo->prepare("SELECT id FROM edu_students WHERE id = ?");
        $exists->execute([$s['id']]);

        $sql = $exists->fetch()
            ? "UPDATE edu_students SET
                name=:name, nat_id=:nat_id, dob=:dob, gender=:gender, grade=:grade,
                addr=:addr, phone=:phone, guardian=:guardian, guardian_phone=:guardian_phone,
                guardian_rel=:guardian_rel, sponsor=:sponsor, ref_num=:ref_num,
                occupation=:occupation, complaint=:complaint, hpi=:hpi,
                past_history=:past_history, special_needs=:special_needs,
                family_bg=:family_bg, social_bg=:social_bg, review_notes=:review_notes,
                findings=:findings, outcome=:outcome, category_code=:category_code,
                action_plan=:action_plan, next_visit_date=:next_visit_date,
                next_visit_note=:next_visit_note, disposition=:disposition,
                room_id=:room_id, room_assigned=:room_assigned, room_name=:room_name,
                balance=:balance, last_visit=:last_visit, rx_list=:rx_list, disp_data=:disp_data
               WHERE id=:id"
            : "INSERT INTO edu_students
                (id,name,nat_id,dob,gender,grade,addr,phone,guardian,guardian_phone,
                 guardian_rel,sponsor,ref_num,occupation,complaint,hpi,past_history,
                 special_needs,family_bg,social_bg,review_notes,findings,outcome,
                 category_code,action_plan,next_visit_date,next_visit_note,disposition,
                 room_id,room_assigned,room_name,balance,last_visit,rx_list,disp_data)
               VALUES
                (:id,:name,:nat_id,:dob,:gender,:grade,:addr,:phone,:guardian,:guardian_phone,
                 :guardian_rel,:sponsor,:ref_num,:occupation,:complaint,:hpi,:past_history,
                 :special_needs,:family_bg,:social_bg,:review_notes,:findings,:outcome,
                 :category_code,:action_plan,:next_visit_date,:next_visit_note,:disposition,
                 :room_id,:room_assigned,:room_name,:balance,:last_visit,:rx_list,:disp_data)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id'              => $s['id'],
            ':name'            => $s['name'] ?? '',
            ':nat_id'          => $s['natID'] ?? '',
            ':dob'             => $s['dob'] ?? '',
            ':gender'          => $s['gender'] ?? '',
            ':grade'           => $s['blood'] ?? '',
            ':addr'            => $s['addr'] ?? '',
            ':phone'           => $s['phone'] ?? '',
            ':guardian'        => $s['kin'] ?? '',
            ':guardian_phone'  => $s['kinPhone'] ?? '',
            ':guardian_rel'    => $s['kinRel'] ?? '',
            ':sponsor'         => $s['ins'] ?? '',
            ':ref_num'         => $s['pol'] ?? '',
            ':occupation'      => $s['occ'] ?? '',
            ':complaint'       => $s['complaint'] ?? '',
            ':hpi'             => $s['hpi'] ?? '',
            ':past_history'    => $s['pastHistory'] ?? '',
            ':special_needs'   => $s['resourceHistory'] ?? '',
            ':family_bg'       => $s['familyHistory'] ?? '',
            ':social_bg'       => $s['socialHistory'] ?? '',
            ':review_notes'    => $s['review'] ?? '',
            ':findings'        => $s['exam'] ?? '',
            ':outcome'         => $s['diagnosis'] ?? '',
            ':category_code'   => $s['icd'] ?? '',
            ':action_plan'     => $s['currentNote'] ?? '',
            ':next_visit_date' => $s['nextVisitDate'] ?? '',
            ':next_visit_note' => $s['nextVisitPurpose'] ?? '',
            ':disposition'     => $s['disposition'] ?? '',
            ':room_id'         => $s['bedWardId'] ?? '',
            ':room_assigned'   => $s['roomAssigned'] ?? '',
            ':room_name'       => $s['wardAssigned'] ?? '',
            ':balance'         => $s['balance'] ?? 0,
            ':last_visit'      => $s['lastVisit'] ?? '',
            ':rx_list'         => json_encode($s['rxList'] ?? []),
            ':disp_data'       => json_encode([
                'dispRD'     => $s['dispRD'] ?? '',
                'dispRR'     => $s['dispRR'] ?? '',
                'dispRH'     => $s['dispRH'] ?? '',
                'dispRDept'  => $s['dispRDept'] ?? '',
                'dispRDate'  => $s['dispRDate'] ?? '',
                'dispReason' => $s['dispReason'] ?? '',
                'dispDN'     => $s['dispDN'] ?? '',
                'dispDD'     => $s['dispDD'] ?? '',
                'dispDC'     => $s['dispDC'] ?? '',
            ]),
        ]);

        respond(['success'=>true,'id'=>$s['id']]);
        break;

    // ── DELETE STUDENT ───────────────────────────────────────
    case 'delete':
        $id = $body['id'] ?? '';
        if (!$id) respond(['success'=>false,'error'=>'Missing ID.']);
        $pdo->prepare("DELETE FROM edu_students WHERE id = ?")->execute([$id]);
        respond(['success'=>true]);
        break;

    default:
        respond(['success'=>false,'error'=>'Unknown action.'], 400);
}

// ── Row mapper: DB row → JS-friendly object ──────────────────
function rowToStudent($r) {
    $dd  = json_decode($r['disp_data'] ?? '{}', true) ?? [];
    $rxl = json_decode($r['rx_list']   ?? '[]', true) ?? [];
    return array_merge([
        'id'               => $r['id'],
        'name'             => $r['name'],
        'natID'            => $r['nat_id'],
        'dob'              => $r['dob'],
        'gender'           => $r['gender'],
        'blood'            => $r['grade'],
        'addr'             => $r['addr'],
        'phone'            => $r['phone'],
        'kin'              => $r['guardian'],
        'kinPhone'         => $r['guardian_phone'],
        'kinRel'           => $r['guardian_rel'],
        'ins'              => $r['sponsor'],
        'pol'              => $r['ref_num'],
        'occ'              => $r['occupation'],
        'complaint'        => $r['complaint'],
        'hpi'              => $r['hpi'],
        'pastHistory'      => $r['past_history'],
        'resourceHistory'  => $r['special_needs'],
        'familyHistory'    => $r['family_bg'],
        'socialHistory'    => $r['social_bg'],
        'review'           => $r['review_notes'],
        'exam'             => $r['findings'],
        'diagnosis'        => $r['outcome'],
        'icd'              => $r['category_code'],
        'currentNote'      => $r['action_plan'],
        'nextVisitDate'    => $r['next_visit_date'],
        'nextVisitPurpose' => $r['next_visit_note'],
        'disposition'      => $r['disposition'],
        'bedWardId'        => $r['room_id'],
        'roomAssigned'     => $r['room_assigned'],
        'wardAssigned'     => $r['room_name'],
        'balance'          => (float)$r['balance'],
        'lastVisit'        => $r['last_visit'],
        'rxList'           => $rxl,
    ], $dd);
}
?>