<?php
declare(strict_types=1);
define('LAB_IMAGE_IMPORT', true);
ini_set('display_errors', '0');
require __DIR__ . '/image-import-lib.php';

$retryAfter = 0;
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        throw new LabImageError('不支持的请求方式。', 405);
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $originParts = $origin !== '' ? parse_url($origin) : false;
    $originHost = is_array($originParts) ? strtolower(($originParts['host'] ?? '') . (isset($originParts['port']) ? ':' . $originParts['port'] : '')) : '';
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if (($origin !== '' && ($originHost !== $host || !in_array($originParts['scheme'] ?? '', ['http', 'https'], true))) ||
        in_array($site, ['cross-site', 'same-site'], true)) {
        throw new LabImageError('请从本站实验页面提交图片。', 403);
    }
    $config = require __DIR__ . '/config.php';
    $key = is_array($config) && is_string($config['api_key'] ?? null) ? trim($config['api_key']) : '';
    $model = is_array($config) && is_string($config['model'] ?? null) ? $config['model'] : 'deepseek-flash';
    $interval = max(60, min(3600, (int)($config['interval_seconds'] ?? 60)));
    $configured = strlen($key) >= 16 && strlen($key) <= 256 && !preg_match('/[\r\n]/', $key);
    $ready = $configured && extension_loaded('curl') && extension_loaded('fileinfo');
    $path = lab_rate_path($_SERVER['REMOTE_ADDR'] ?? 'unknown', __DIR__);
    $retryAfter = lab_rate($path, $interval, false);
    if ($method === 'GET') {
        lab_reply(200, [
            'ok' => true, 'configured' => $configured, 'ready' => $ready,
            'message' => !$configured ? '站点尚未配置图片识别 API Key。' : (!$ready ? '服务器需要启用 PHP curl 和 fileinfo 扩展。' : '图片识别已就绪。'),
            'interval_seconds' => $interval, 'retry_after' => $retryAfter, 'max_bytes' => 5 * 1024 * 1024,
        ]);
        exit;
    }
    if (!$ready) {
        throw new LabImageError(!$configured ? '站点尚未配置图片识别 API Key。' : '服务器需要启用 PHP curl 和 fileinfo 扩展。', 503);
    }
    if ($retryAfter > 0) {
        throw new LabImageError('同一访问 IP 每分钟只能提交一张图片，请等待倒计时结束。', 429);
    }
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 8 * 1024 * 1024) {
        throw new LabImageError('图片请求过大，请裁剪图片后重试。', 413);
    }
    if (!is_string($_POST['schema'] ?? null)) {
        throw new LabImageError('未收到表格信息。若图片较大，请检查服务器上传大小限制。');
    }
    $schema = lab_schema($_POST['schema']);
    $file = $_FILES['image'] ?? null;
    if (!is_array($file) || is_array($file['error'] ?? null) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new LabImageError('图片上传失败，请使用较小的 JPG、PNG 或 WebP 图片。');
    }
    if (($file['size'] ?? 0) < 1 || $file['size'] > 5 * 1024 * 1024 || !is_uploaded_file($file['tmp_name'])) {
        throw new LabImageError('图片大小无效，单张图片最多 5 MB。', 413);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $size = @getimagesize($file['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || !$size ||
        ($size['mime'] ?? '') !== $mime || max($size[0], $size[1]) > 8192 || $size[0] * $size[1] > 40000000) {
        throw new LabImageError('图片格式或尺寸不支持，请转换为 JPG、PNG 或 WebP，并裁剪到清晰的实验表格。');
    }
    $bytes = file_get_contents($file['tmp_name']);
    if ($bytes === false) {
        throw new LabImageError('无法读取上传图片，请重试。');
    }
    $remaining = lab_rate($path, $interval, true);
    if ($remaining > 0) {
        $retryAfter = $remaining;
        throw new LabImageError('另一张图片刚刚提交，请等待倒计时结束。', 429);
    }
    $retryAfter = $interval;
    $response = lab_deepseek(lab_payload($schema, $mime, $bytes, $model), $key);
    $result = lab_result($response, $schema);
    $retryAfter = lab_rate($path, $interval, false);
    lab_reply(200, ['ok' => true, 'retry_after' => $retryAfter] + $result);
} catch (LabImageError $error) {
    lab_reply($error->status, ['ok' => false, 'error' => $error->getMessage(), 'retry_after' => $retryAfter]);
} catch (Throwable $error) {
    // 不把 Key、图片、模型原始响应或服务器路径写入响应/日志。
    lab_reply(500, ['ok' => false, 'error' => '图片识别暂不可用，请检查服务器配置或稍后重试。', 'retry_after' => $retryAfter]);
}
