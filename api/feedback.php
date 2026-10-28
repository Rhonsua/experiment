<?php
declare(strict_types=1);
define('LAB_FEEDBACK', true);
ini_set('display_errors', '0');
require __DIR__ . '/feedback-lib.php';
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        throw new FeedbackError('不支持的请求方式。', 405);
    }
    $directory = __DIR__ . '/feedback-data';
    if ($method === 'GET') {
        $ready = is_dir($directory) && !is_link($directory) && is_writable($directory);
        fb_reply(200, ['ok' => true, 'ready' => $ready, 'interval_seconds' => FB_INTERVAL, 'max_length' => 2000, 'message' => $ready ? '反馈服务已就绪。' : '反馈存储目录暂不可写。']);
        exit;
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $parts = $origin !== '' ? parse_url($origin) : false;
    $originHost = is_array($parts) ? strtolower(($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '')) : '';
    if (($origin !== '' && ($originHost !== strtolower($_SERVER['HTTP_HOST'] ?? '') || !in_array($parts['scheme'] ?? '', ['http', 'https'], true))) || in_array($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '', ['cross-site', 'same-site'], true)) {
        throw new FeedbackError('请从本站页面提交反馈。', 403);
    }
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new FeedbackError('请使用本站反馈窗口提交。', 415);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16000) throw new FeedbackError('反馈内容过长。', 413);
    $raw = file_get_contents('php://input', false, null, 0, 16001);
    if ($raw === false || strlen($raw) > 16000) throw new FeedbackError('反馈内容过长。', 413);
    try { $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { throw new FeedbackError('反馈格式无效，请刷新页面后重试。'); }
    if (!is_array($data)) throw new FeedbackError('反馈格式无效。');
    $input = fb_validate($data);
    $result = fb_store($input, $directory, $_SERVER['REMOTE_ADDR'] ?? 'unknown', time());
    fb_reply(201, ['ok' => true, 'message' => '反馈已提交，谢谢你的建议！'] + $result);
} catch (FeedbackError $error) {
    fb_reply($error->status, ['ok' => false, 'error' => $error->getMessage(), 'retry_after' => $error->retry]);
} catch (Throwable $error) {
    // 不把反馈正文、联系方式、IP 或服务器路径写入公开响应和错误日志。
    fb_reply(500, ['ok' => false, 'error' => '反馈暂时无法保存，内容仍在输入框内，请稍后重试。']);
}
