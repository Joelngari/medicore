<?php
// ============================================================
//  api/auth.php — Authentication API
//  Handles: login, register, logout, forgot password
//  Called by: app.js via fetch()
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

    // ── LOGIN ────────────────────────────────────────────────
    case 'login':
        $username = strtolower(trim($body['username'] ?? ''));
        $password = trim($body['password'] ?? '');

        if (!$username || !$password) {
            respond(['success' => false, 'error' => 'Please enter username and password.']);
        }

        $stmt = $pdo->prepare("SELECT * FROM edu_users WHERE LOWER(username) = ? LIMIT 1");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) {
            respond(['success' => false, 'error' => 'Incorrect username or password.']);
        }
        if ($user['password'] !== $password) {
            respond(['success' => false, 'error' => 'Incorrect username or password.']);
        }
        if ($user['status'] === 'rejected') {
            respond(['success' => false, 'error' => 'This account has been disabled. Contact admin.']);
        }

        // Log the login
        $stmt2 = $pdo->prepare("INSERT INTO edu_logs (time_str, username, action, target, details, cls) VALUES (?,?,?,?,?,?)");
        $stmt2->execute([now(), $user['name'], 'LOGIN', $user['id'], $user['name'].' signed in', 'bg']);

        respond(['success' => true, 'user' => [
            'id'      => $user['id'],
            'name'    => $user['name'],
            'username'=> $user['username'],
            'role'    => $user['role'],
            'dept'    => $user['dept'],
            'staffId' => $user['staff_id'],
            'status'  => $user['status'],
        ]]);
        break;

    // ── REGISTER ─────────────────────────────────────────────
    case 'register':
        $name     = trim($body['name'] ?? '');
        $username = strtolower(trim($body['username'] ?? ''));
        $password = trim($body['password'] ?? '');
        $role     = $body['role'] ?? 'teacher';
        $secQ     = $body['secQ'] ?? '';
        $secA     = strtolower(trim($body['secA'] ?? ''));

        if (!$name)     respond(['success'=>false,'error'=>'Please enter your full name.']);
        if (!$username) respond(['success'=>false,'error'=>'Please choose a username.']);
        if (strlen($password) < 4) respond(['success'=>false,'error'=>'Password must be at least 4 characters.']);
        if (!$secQ)     respond(['success'=>false,'error'=>'Please select a security question.']);
        if (!$secA)     respond(['success'=>false,'error'=>'Please provide a security answer.']);

        // Check username taken
        $check = $pdo->prepare("SELECT id FROM edu_users WHERE LOWER(username) = ? LIMIT 1");
        $check->execute([$username]);
        if ($check->fetch()) {
            respond(['success'=>false,'error'=>'That username is already taken. Try another.']);
        }

        $id = 'USR-' . strtoupper(substr(md5(uniqid()), 0, 8));
        $stmt = $pdo->prepare("INSERT INTO edu_users (id,name,username,email,password,role,dept,staff_id,status,sec_q,sec_a) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $id, $name, $username,
            $username . '@educore.local',
            $password, $role,
            'General Counselling',
            'STF-' . strtoupper(substr(md5(uniqid()), 0, 6)),
            'approved', $secQ, $secA
        ]);

        respond(['success'=>true, 'message'=>'Account created! You can now sign in.', 'username'=>$username]);
        break;

    // ── FORGOT PASSWORD LOOKUP ───────────────────────────────
    case 'forgot_lookup':
        $username = strtolower(trim($body['username'] ?? ''));
        if (!$username) respond(['success'=>false,'error'=>'Please enter your username.']);

        $stmt = $pdo->prepare("SELECT sec_q FROM edu_users WHERE LOWER(username) = ? LIMIT 1");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) respond(['success'=>false,'error'=>'No account found with that username.']);
        if (!$user['sec_q']) respond(['success'=>false,'error'=>'No security question set. Contact admin.']);

        respond(['success'=>true,'question'=>$user['sec_q']]);
        break;

    // ── FORGOT PASSWORD RESET ────────────────────────────────
    case 'forgot_reset':
        $username = strtolower(trim($body['username'] ?? ''));
        $answer   = strtolower(trim($body['answer'] ?? ''));
        $newPass  = trim($body['newPass'] ?? '');

        if (!$answer)  respond(['success'=>false,'error'=>'Please enter your security answer.']);
        if (strlen($newPass) < 4) respond(['success'=>false,'error'=>'Password must be at least 4 characters.']);

        $stmt = $pdo->prepare("SELECT id, sec_a FROM edu_users WHERE LOWER(username) = ? LIMIT 1");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user) respond(['success'=>false,'error'=>'User not found.']);
        if ($user['sec_a'] !== $answer) respond(['success'=>false,'error'=>'Incorrect answer. Please try again.']);

        $pdo->prepare("UPDATE edu_users SET password = ? WHERE id = ?")->execute([$newPass, $user['id']]);
        respond(['success'=>true,'message'=>'Password reset successfully! You can now sign in.']);
        break;

    // ── GET ALL USERS (admin only) ───────────────────────────
    case 'get_users':
        $stmt = $pdo->query("SELECT id,name,username,email,role,dept,staff_id,status,created_at FROM edu_users ORDER BY created_at DESC");
        $users = $stmt->fetchAll();
        // Map to JS-friendly camelCase
        $mapped = array_map(fn($u) => [
            'id'      => $u['id'],
            'name'    => $u['name'],
            'username'=> $u['username'],
            'email'   => $u['email'],
            'role'    => $u['role'],
            'dept'    => $u['dept'],
            'staffId' => $u['staff_id'],
            'status'  => $u['status'],
            'created' => substr($u['created_at'], 0, 10),
        ], $users);
        respond(['success'=>true,'users'=>$mapped]);
        break;

    // ── UPDATE USER STATUS ───────────────────────────────────
    case 'update_user_status':
        $id     = $body['id'] ?? '';
        $status = $body['status'] ?? '';
        if (!$id || !$status) respond(['success'=>false,'error'=>'Missing fields.']);
        $pdo->prepare("UPDATE edu_users SET status = ? WHERE id = ?")->execute([$status, $id]);
        respond(['success'=>true]);
        break;

    // ── DELETE USER ──────────────────────────────────────────
    case 'delete_user':
        $id = $body['id'] ?? '';
        if (!$id) respond(['success'=>false,'error'=>'Missing ID.']);
        $pdo->prepare("DELETE FROM edu_users WHERE id = ?")->execute([$id]);
        respond(['success'=>true]);
        break;

    // ── CREATE ADMIN ACCOUNT ─────────────────────────────────
    case 'create_account':
        $name     = trim($body['name'] ?? '');
        $username = strtolower(trim($body['username'] ?? ''));
        $password = trim($body['password'] ?? '');
        $role     = $body['role'] ?? 'teacher';

        if (!$name || !$username || strlen($password) < 4) {
            respond(['success'=>false,'error'=>'All fields required, password min 4 chars.']);
        }

        $check = $pdo->prepare("SELECT id FROM edu_users WHERE LOWER(username) = ?");
        $check->execute([$username]);
        if ($check->fetch()) respond(['success'=>false,'error'=>'Username already exists.']);

        $id = 'USR-' . strtoupper(substr(md5(uniqid()), 0, 8));
        $pdo->prepare("INSERT INTO edu_users (id,name,username,email,password,role,dept,staff_id,status) VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([$id,$name,$username,$username.'@educore.local',$password,$role,'Administration','ADM-'.strtoupper(substr(md5(uniqid()),0,6)),'approved']);
        respond(['success'=>true,'message'=>'Account created for @'.$username]);
        break;

    default:
        respond(['success'=>false,'error'=>'Unknown action: '.$action], 400);
}
?>