<?php
require_once 'db.php';

$tables = [

"CREATE TABLE IF NOT EXISTS edu_users (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    username    VARCHAR(80)  UNIQUE NOT NULL,
    email       VARCHAR(150),
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(50)  NOT NULL DEFAULT 'teacher',
    dept        VARCHAR(100),
    staff_id    VARCHAR(50),
    status      VARCHAR(20)  DEFAULT 'approved',
    sec_q       TEXT,
    sec_a       VARCHAR(255),
    created_at  DATETIME     DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_students (
    id               VARCHAR(50)  PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    nat_id           VARCHAR(50),
    dob              VARCHAR(20),
    gender           VARCHAR(20),
    grade            VARCHAR(30),
    addr             TEXT,
    phone            VARCHAR(30),
    guardian         VARCHAR(150),
    guardian_phone   VARCHAR(30),
    guardian_rel     VARCHAR(80),
    sponsor          VARCHAR(150),
    ref_num          VARCHAR(80),
    occupation       VARCHAR(100),
    complaint        TEXT,
    hpi              TEXT,
    past_history     TEXT,
    special_needs    TEXT,
    family_bg        TEXT,
    social_bg        TEXT,
    review_notes     TEXT,
    findings         TEXT,
    outcome          TEXT,
    category_code    VARCHAR(30),
    action_plan      TEXT,
    next_visit_date  VARCHAR(30),
    next_visit_note  TEXT,
    disposition      VARCHAR(30),
    room_id          VARCHAR(50),
    room_assigned    VARCHAR(50),
    room_name        VARCHAR(100),
    balance          DECIMAL(12,2) DEFAULT 0,
    last_visit       VARCHAR(30),
    rx_list          MEDIUMTEXT,
    disp_data        MEDIUMTEXT,
    created_at       DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_intake (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(150),
    complaint   TEXT,
    level       TINYINT,
    bp          VARCHAR(30),
    pr          VARCHAR(30),
    temp        VARCHAR(30),
    spo2        VARCHAR(30),
    counsellor  VARCHAR(150),
    status      VARCHAR(30) DEFAULT 'Waiting',
    created_at  DATETIME    DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_sessions (
    id          VARCHAR(50)  PRIMARY KEY,
    student     VARCHAR(150),
    student_id  VARCHAR(50),
    teacher     VARCHAR(150),
    dept        VARCHAR(100),
    date        VARCHAR(20),
    time        VARCHAR(20),
    type        VARCHAR(80),
    notes       TEXT,
    status      VARCHAR(30) DEFAULT 'Scheduled',
    created_at  DATETIME    DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_metrics (
    id            VARCHAR(50)  PRIMARY KEY,
    student_id    VARCHAR(50),
    student_name  VARCHAR(150),
    attendance    VARCHAR(30),
    gpa           VARCHAR(30),
    behaviour     VARCHAR(30),
    participation VARCHAR(30),
    homework      VARCHAR(30),
    credits       VARCHAR(30),
    total_credits VARCHAR(30),
    credit_ratio  VARCHAR(30),
    test_avg      VARCHAR(30),
    notes         TEXT,
    created_at    DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_exams (
    id           VARCHAR(50)  PRIMARY KEY,
    student_id   VARCHAR(50),
    student_name VARCHAR(150),
    category     VARCHAR(100),
    note         TEXT,
    priority     VARCHAR(30),
    teacher      VARCHAR(150),
    status       VARCHAR(30) DEFAULT 'Pending',
    result       TEXT,
    created_at   DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_rooms (
    id         VARCHAR(50)  PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    seats      MEDIUMTEXT,
    created_at DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_inventory (
    id         VARCHAR(50)  PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    category   VARCHAR(80),
    qty        INT          DEFAULT 0,
    unit       VARCHAR(30),
    reorder    INT          DEFAULT 10,
    price      DECIMAL(10,2) DEFAULT 0,
    expiry     VARCHAR(30),
    supplier   VARCHAR(150),
    created_at DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_invoices (
    id         VARCHAR(50)  PRIMARY KEY,
    student_id VARCHAR(50),
    items      MEDIUMTEXT,
    total      DECIMAL(12,2),
    paid       DECIMAL(12,2),
    balance    DECIMAL(12,2),
    method     VARCHAR(80),
    date       VARCHAR(30),
    created_at DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_staff (
    id         VARCHAR(50)  PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    staff_id   VARCHAR(50),
    role       VARCHAR(80),
    dept       VARCHAR(100),
    phone      VARCHAR(30),
    status     VARCHAR(50),
    spec       VARCHAR(150),
    joined     VARCHAR(30),
    created_at DATETIME DEFAULT '2000-01-01 00:00:00'
)",

"CREATE TABLE IF NOT EXISTS edu_logs (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    time_str   VARCHAR(50),
    username   VARCHAR(80),
    action     VARCHAR(100),
    target     VARCHAR(100),
    details    TEXT,
    cls        VARCHAR(20),
    created_at DATETIME DEFAULT '2000-01-01 00:00:00'
)",

];

$results = [];
$allOk   = true;

foreach ($tables as $sql) {
    preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/i', $sql, $m);
    $tableName = $m[1] ?? 'unknown';
    try {
        $pdo->exec($sql);
        $results[] = ['table' => $tableName, 'status' => '✅ OK'];
    } catch (PDOException $e) {
        $results[] = ['table' => $tableName, 'status' => '❌ ' . $e->getMessage()];
        $allOk = false;
    }
}

// Seed default admin
try {
    $pdo->exec("INSERT IGNORE INTO edu_users
        (id,name,username,email,password,role,dept,staff_id,status,created_at)
        VALUES (
            'USR-ADMIN','System Administrator','admin',
            'admin@educore.local','Admin@1234',
            'admin','Administration','ADMIN-001','approved','2000-01-01 00:00:00'
        )");
    $results[] = ['table' => 'Default admin', 'status' => '✅ Seeded (admin / Admin@1234)'];
} catch (PDOException $e) {
    $results[] = ['table' => 'Default admin', 'status' => '⚠️ ' . $e->getMessage()];
}
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>EduCore Setup</title>
<style>
  body{font-family:sans-serif;background:#f0f9ff;padding:40px;color:#0f172a;}
  h1{color:#0284c7;}
  table{border-collapse:collapse;width:100%;max-width:600px;margin-top:20px;}
  th,td{padding:10px 16px;border:1px solid #bfdbfe;text-align:left;font-size:.9rem;}
  th{background:#0ea5e9;color:#fff;}
  tr:nth-child(even){background:#f0f9ff;}
  .done{background:#dcfce7;border:1px solid #86efac;padding:16px 20px;border-radius:8px;margin-top:24px;font-weight:700;color:#15803d;}
  .err{background:#fee2e2;border:1px solid #fca5a5;padding:16px 20px;border-radius:8px;margin-top:24px;color:#dc2626;}
  a.btn{display:inline-block;margin-top:20px;padding:12px 28px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;}
</style>
</head>
<body>
<h1>⚡ EduCore Database Setup</h1>
<table>
  <tr><th>Table</th><th>Status</th></tr>
  <?php foreach($results as $r): ?>
  <tr><td><?= htmlspecialchars($r['table']) ?></td><td><?= htmlspecialchars($r['status']) ?></td></tr>
  <?php endforeach; ?>
</table>
<?php if($allOk): ?>
<div class="done">
  ✅ All tables created!<br><br>
  Login: <strong>admin / Admin@1234</strong>
</div>
<a class="btn" href="index.html">Open EduCore →</a>
<?php else: ?>
<div class="err">❌ Some tables failed. Check errors above.</div>
<?php endif; ?>
</body>
</html>