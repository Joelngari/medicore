<?php
// ============================================================
//  api/data.php — General data API
//  Handles all other tables: intake, sessions, metrics,
//  exams, rooms, inventory, invoices, staff, logs
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once '../db.php';

$body   = getBody();
$action = $body['action'] ?? $_GET['action'] ?? '';

switch ($action) {

    // ════════════════════════════════════════════════════════
    //  INTAKE
    // ════════════════════════════════════════════════════════
    case 'get_intake':
        $rows = $pdo->query("SELECT * FROM edu_intake ORDER BY created_at DESC")->fetchAll();
        respond(['success'=>true,'intake'=>$rows]);
        break;

    case 'save_intake':
        $r = $body['record'] ?? [];
        upsert($pdo, 'edu_intake', $r, ['id','name','complaint','level','bp','pr','temp','spo2','counsellor','status']);
        respond(['success'=>true]);
        break;

    case 'delete_intake':
        $pdo->prepare("DELETE FROM edu_intake WHERE id = ?")->execute([$body['id'] ?? '']);
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  SESSIONS (appointments)
    // ════════════════════════════════════════════════════════
    case 'get_sessions':
        $rows = $pdo->query("SELECT * FROM edu_sessions ORDER BY created_at DESC")->fetchAll();
        respond(['success'=>true,'sessions'=>$rows]);
        break;

    case 'save_session':
        $r = $body['record'] ?? [];
        upsert($pdo, 'edu_sessions', $r, ['id','student','student_id','teacher','dept','date','time','type','notes','status']);
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  ACADEMIC METRICS
    // ════════════════════════════════════════════════════════
    case 'get_metrics':
        $rows = $pdo->query("SELECT * FROM edu_metrics ORDER BY created_at DESC")->fetchAll();
        respond(['success'=>true,'metrics'=>$rows]);
        break;

    case 'save_metric':
        $r = $body['record'] ?? [];
        $id = 'MET-' . strtoupper(substr(md5(uniqid()), 0, 8));
        $pdo->prepare("INSERT INTO edu_metrics
            (id,student_id,student_name,attendance,gpa,behaviour,participation,homework,credits,total_credits,credit_ratio,test_avg,notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $id,
                $r['student_id']    ?? '',
                $r['student_name']  ?? '',
                $r['attendance']    ?? '',
                $r['gpa']           ?? '',
                $r['behaviour']     ?? '',
                $r['participation'] ?? '',
                $r['homework']      ?? '',
                $r['credits']       ?? '',
                $r['total_credits'] ?? '',
                $r['credit_ratio']  ?? '',
                $r['test_avg']      ?? '',
                $r['notes']         ?? '',
            ]);
        respond(['success'=>true,'id'=>$id]);
        break;

    // ════════════════════════════════════════════════════════
    //  EXAMINATIONS
    // ════════════════════════════════════════════════════════
    case 'get_exams':
        $rows = $pdo->query("SELECT * FROM edu_exams ORDER BY created_at DESC")->fetchAll();
        respond(['success'=>true,'exams'=>$rows]);
        break;

    case 'save_exam':
        $r = $body['record'] ?? [];
        upsert($pdo, 'edu_exams', $r, ['id','student_id','student_name','category','note','priority','teacher','status','result']);
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  ROOMS & SEATS
    // ════════════════════════════════════════════════════════
    case 'get_rooms':
        $rows = $pdo->query("SELECT * FROM edu_rooms ORDER BY created_at ASC")->fetchAll();
        $rooms = array_map(function($r) {
            $seats = json_decode($r['seats'] ?? '[]', true) ?? [];
            return ['id'=>$r['id'],'name'=>$r['name'],'beds'=>$seats];
        }, $rows);
        respond(['success'=>true,'rooms'=>$rooms]);
        break;

    case 'save_room':
        $r = $body['record'] ?? [];
        $seats = json_encode($r['beds'] ?? $r['seats'] ?? []);
        $exists = $pdo->prepare("SELECT id FROM edu_rooms WHERE id = ?");
        $exists->execute([$r['id']]);
        if ($exists->fetch()) {
            $pdo->prepare("UPDATE edu_rooms SET name=?, seats=? WHERE id=?")->execute([$r['name'], $seats, $r['id']]);
        } else {
            $pdo->prepare("INSERT INTO edu_rooms (id,name,seats) VALUES (?,?,?)")->execute([$r['id'], $r['name'], $seats]);
        }
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  INVENTORY (Library)
    // ════════════════════════════════════════════════════════
    case 'get_inventory':
        $rows = $pdo->query("SELECT * FROM edu_inventory ORDER BY created_at DESC")->fetchAll();
        respond(['success'=>true,'inventory'=>$rows]);
        break;

    case 'save_inventory':
        $r = $body['record'] ?? [];
        upsert($pdo, 'edu_inventory', $r, ['id','name','category','qty','unit','reorder','price','expiry','supplier']);
        respond(['success'=>true]);
        break;

    case 'delete_inventory':
        $pdo->prepare("DELETE FROM edu_inventory WHERE id = ?")->execute([$body['id'] ?? '']);
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  INVOICES / FEES
    // ════════════════════════════════════════════════════════
    case 'get_invoices':
        $rows = $pdo->query("SELECT * FROM edu_invoices ORDER BY created_at DESC")->fetchAll();
        $invoices = array_map(function($r) {
            $r['items'] = json_decode($r['items'] ?? '[]', true) ?? [];
            return $r;
        }, $rows);
        respond(['success'=>true,'invoices'=>$invoices]);
        break;

    case 'save_invoice':
        $r = $body['record'] ?? [];
        $pdo->prepare("INSERT INTO edu_invoices (id,student_id,items,total,paid,balance,method,date)
                       VALUES (?,?,?,?,?,?,?,?)")
            ->execute([
                $r['id']         ?? 'INV-'.time(),
                $r['pid']        ?? $r['student_id'] ?? '',
                json_encode($r['items'] ?? []),
                $r['total']      ?? 0,
                $r['paid']       ?? 0,
                $r['balance']    ?? 0,
                $r['method']     ?? '',
                $r['date']       ?? date('Y-m-d'),
            ]);
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  STAFF
    // ════════════════════════════════════════════════════════
    case 'get_staff':
        $rows = $pdo->query("SELECT * FROM edu_staff ORDER BY created_at DESC")->fetchAll();
        respond(['success'=>true,'staff'=>$rows]);
        break;

    case 'save_staff':
        $r = $body['record'] ?? [];
        $pdo->prepare("INSERT INTO edu_staff (id,name,staff_id,role,dept,phone,status,spec,joined)
                       VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([
                $r['id']      ?? '',
                $r['name']    ?? '',
                $r['staffId'] ?? $r['staff_id'] ?? '',
                $r['role']    ?? '',
                $r['dept']    ?? '',
                $r['phone']   ?? '',
                $r['status']  ?? 'In Class',
                $r['spec']    ?? '',
                $r['joined']  ?? date('Y-m-d'),
            ]);
        respond(['success'=>true]);
        break;

    case 'delete_staff':
        $pdo->prepare("DELETE FROM edu_staff WHERE id = ?")->execute([$body['id'] ?? '']);
        respond(['success'=>true]);
        break;

    // ════════════════════════════════════════════════════════
    //  AUDIT LOGS
    // ════════════════════════════════════════════════════════
    case 'get_logs':
        $rows = $pdo->query("SELECT * FROM edu_logs ORDER BY created_at DESC LIMIT 300")->fetchAll();
        $logs = array_map(fn($r) => [
            'time'    => $r['time_str'],
            'user'    => $r['username'],
            'action'  => $r['action'],
            'target'  => $r['target'],
            'details' => $r['details'],
            'cls'     => $r['cls'],
        ], $rows);
        respond(['success'=>true,'logs'=>$logs]);
        break;

    case 'add_log':
        $r = $body['record'] ?? [];
        $pdo->prepare("INSERT INTO edu_logs (time_str,username,action,target,details,cls) VALUES (?,?,?,?,?,?)")
            ->execute([
                $r['time']    ?? now(),
                $r['user']    ?? 'System',
                $r['action']  ?? '',
                $r['target']  ?? '',
                $r['details'] ?? '',
                $r['cls']     ?? 'bb',
            ]);
        respond(['success'=>true]);
        break;

    default:
        respond(['success'=>false,'error'=>'Unknown action: '.$action], 400);
}

// ── Generic upsert helper ────────────────────────────────────
function upsert(PDO $pdo, string $table, array $data, array $fields): void {
    if (empty($data['id'])) return;

    $exists = $pdo->prepare("SELECT id FROM {$table} WHERE id = ?");
    $exists->execute([$data['id']]);

    $vals = array_map(fn($f) => $data[$f] ?? null, $fields);

    if ($exists->fetch()) {
        // UPDATE all fields except id
        $setCols = implode(', ', array_map(fn($f) => "{$f} = ?", array_filter($fields, fn($f) => $f !== 'id')));
        $updateVals = array_values(array_filter($vals, fn($v, $k) => $fields[$k] !== 'id', ARRAY_FILTER_USE_BOTH));
        $updateVals[] = $data['id'];
        $pdo->prepare("UPDATE {$table} SET {$setCols} WHERE id = ?")->execute($updateVals);
    } else {
        $cols = implode(', ', $fields);
        $placeholders = implode(', ', array_fill(0, count($fields), '?'));
        $pdo->prepare("INSERT INTO {$table} ({$cols}) VALUES ({$placeholders})")->execute($vals);
    }
}
?>