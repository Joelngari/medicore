<?php
// ============================================================
//  db.php — Database connection
//  Works on XAMPP locally AND on Render.com in production
//  Render automatically injects the environment variables
// ============================================================

$host    = getenv('DB_HOST')  ?: 'localhost';
$dbname  = getenv('DB_NAME')  ?: 'educore';
$user    = getenv('DB_USER')  ?: 'root';
$pass    = getenv('DB_PASS')  ?: '';
$port    = getenv('DB_PORT')  ?: '3306';
$charset = 'utf8mb4';

$dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error'   => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}

function respond($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function now() {
    return date('Y-m-d H:i:s');
}
?>
