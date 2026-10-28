<?php
if (!defined('LAB_FEEDBACK')) {
    http_response_code(404);
    exit;
}
const FB_GUARD = "<?php http_response_code(404); exit; __halt_compiler();\n";
const FB_INTERVAL = 60;
const FB_MAX_MONTH = 16777216;

final class FeedbackError extends RuntimeException
{
    public int $status;
    public int $retry;
    public function __construct(string $message, int $status = 400, int $retry = 0)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->retry = $retry;
    }
}
function fb_reply(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if (!empty($data['retry_after'])) header('Retry-After: ' . (int)$data['retry_after']);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}
function fb_text($value, string $label, int $min, int $max): string
{
    if (!is_string($value) || strlen($value) > $max * 4 + 16 || preg_match('//u', $value) !== 1 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        throw new FeedbackError($label . '格式不正确。');
    }
    $value = trim(str_replace(["\r\n", "\r"], "\n", $value));
    $length = preg_match_all('/./us', $value);
    if ($length < $min || $length > $max) throw new FeedbackError($label . '长度应为 ' . $min . '～' . $max . ' 字。');
    return $value;
}
function fb_validate(array $data): array
{
    $categories = ['calculation' => '计算问题', 'display' => '显示或操作问题', 'suggestion' => '功能建议', 'other' => '其他反馈'];
    if (!is_string($data['category'] ?? null) || !isset($categories[$data['category']])) throw new FeedbackError('请选择有效的反馈类型。');
    if (($data['website'] ?? '') !== '') throw new FeedbackError('未能提交，请刷新页面后重试。');
    $message = fb_text($data['message'] ?? null, '反馈内容', 2, 2000);
    $contact = fb_text($data['contact'] ?? '', '联系方式', 0, 100);
    if (strpos($contact, "\n") !== false) throw new FeedbackError('联系方式不能换行。');
    $title = fb_text($data['title'] ?? '', '页面名称', 0, 120);
    $page = $data['page'] ?? null;
    if (!is_string($page) || !preg_match('~^/(?:[a-zA-Z0-9_-]+\.html)?$~D', $page)) throw new FeedbackError('页面地址无效，请从本站页面提交。');
    $request = $data['request_id'] ?? null;
    if (!is_string($request) || !preg_match('/^[a-f0-9]{32}$/D', $request)) throw new FeedbackError('提交标识无效，请刷新页面后重试。');
    return ['category' => $data['category'], 'message' => $message, 'contact' => $contact, 'title' => $title, 'page' => $page === '/' ? '/index.html' : $page, 'request_id' => $request];
}
function fb_read_private(string $path): string
{
    if (is_link($path)) throw new RuntimeException('Invalid storage');
    if (!file_exists($path)) return '';
    $data = file_get_contents($path);
    if ($data === false || substr($data, 0, strlen(FB_GUARD)) !== FB_GUARD) throw new RuntimeException('Invalid storage');
    return substr($data, strlen(FB_GUARD));
}
function fb_write_all($handle, string $data): void
{
    $length = strlen($data);
    for ($offset = 0; $offset < $length;) {
        $written = fwrite($handle, substr($data, $offset));
        if ($written === false || $written === 0) throw new RuntimeException('Write failed');
        $offset += $written;
    }
    if (!fflush($handle)) throw new RuntimeException('Flush failed');
}
function fb_store(array $input, string $directory, string $ip, int $now): array
{
    if (!is_dir($directory) || is_link($directory) || !is_writable($directory)) throw new FeedbackError('反馈暂时无法保存，请稍后重试。', 503);
    $lockPath = $directory . '/feedback-lock.php';
    if (is_link($lockPath)) throw new RuntimeException('Invalid storage');
    $lock = fopen($lockPath, 'c+b');
    if (!$lock) throw new RuntimeException('Storage unavailable');
    try {
        if (!flock($lock, LOCK_EX)) throw new RuntimeException('Lock unavailable');
        $lockSize = fstat($lock)['size'];
        if ($lockSize === 0) fb_write_all($lock, FB_GUARD);
        else {
            rewind($lock);
            if (fread($lock, strlen(FB_GUARD)) !== FB_GUARD) throw new RuntimeException('Invalid storage');
        }
        $statePath = $directory . '/feedback-state.php';
        if (is_file($statePath) && filesize($statePath) > 2097152) throw new FeedbackError('反馈暂时无法保存，请稍后重试。', 503);
        $stateRaw = fb_read_private($statePath);
        $state = $stateRaw === '' ? ['salt' => bin2hex(random_bytes(24)), 'ips' => []] : json_decode($stateRaw, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($state) || !is_string($state['salt'] ?? null) || !is_array($state['ips'] ?? null)) throw new RuntimeException('Invalid state');
        foreach ($state['ips'] as $hash => $bucket) if (($bucket['last'] ?? 0) < $now - 86400) unset($state['ips'][$hash]);
        $hash = hash_hmac('sha256', $ip, $state['salt']);
        $bucket = $state['ips'][$hash] ?? ['last' => 0, 'requests' => []];
        $fingerprint = hash('sha256', json_encode($input, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        foreach ($bucket['requests'] as $request) if ($request['request_id'] === $input['request_id']) {
            if (!hash_equals($request['fingerprint'], $fingerprint)) throw new FeedbackError('表单内容已变化，请重新提交。', 409);
            return ['receipt' => $request['receipt'], 'retry_after' => max(0, FB_INTERVAL - ($now - $bucket['last'])), 'duplicate' => true];
        }
        $retry = FB_INTERVAL - ($now - $bucket['last']);
        if ($retry > 0) throw new FeedbackError('提交较频繁，请稍等片刻再试。', 429, $retry);
        $time = (new DateTimeImmutable('@' . $now))->setTimezone(new DateTimeZone('Asia/Shanghai'));
        $day = $time->format('Y-m-d');
        if (($state['day'] ?? '') !== $day) { $state['day'] = $day; $state['count'] = 0; }
        if ($state['count'] >= 1000) throw new FeedbackError('反馈暂时无法保存，请稍后重试。', 503);
        $receipt = 'FB-' . $time->format('Ymd') . '-' . bin2hex(random_bytes(5));
        $category = ['calculation' => '计算问题', 'display' => '显示或操作问题', 'suggestion' => '功能建议', 'other' => '其他反馈'][$input['category']];
        $record = ['反馈编号' => $receipt, '提交时间' => $time->format('Y-m-d H:i:s') . ' +08:00', '反馈类型' => $category, '所在页面' => $input['page'], '页面名称' => $input['title'], '反馈内容' => $input['message'], '联系方式' => $input['contact'] === '' ? '未填写' : $input['contact']];
        $entry = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n\n";
        $monthPath = $directory . '/feedback-' . $time->format('Y-m') . '.txt.php';
        if (is_link($monthPath)) throw new RuntimeException('Invalid storage');
        $month = fopen($monthPath, 'c+b');
        if (!$month) throw new RuntimeException('Storage unavailable');
        $oldSize = fstat($month)['size'];
        try {
            if ($oldSize > 0) {
                rewind($month);
                if (fread($month, strlen(FB_GUARD)) !== FB_GUARD) throw new RuntimeException('Invalid storage');
            }
            if ($oldSize + strlen(FB_GUARD) + strlen($entry) > FB_MAX_MONTH) throw new FeedbackError('反馈文件暂时已满，请稍后重试。', 503);
            $bucket['last'] = $now;
            $bucket['requests'][] = ['request_id' => $input['request_id'], 'fingerprint' => $fingerprint, 'receipt' => $receipt];
            $bucket['requests'] = array_slice($bucket['requests'], -10);
            $state['ips'][$hash] = $bucket;
            $state['count']++;
            $newState = FB_GUARD . json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $stateHandle = fopen($statePath, 'c+b');
            if (!$stateHandle) throw new RuntimeException('Storage unavailable');
            try {
                fseek($month, 0, SEEK_END);
                if ($oldSize === 0) fb_write_all($month, FB_GUARD);
                fb_write_all($month, $entry);
                rewind($stateHandle);
                fb_write_all($stateHandle, $newState);
                if (!ftruncate($stateHandle, strlen($newState))) throw new RuntimeException('State write failed');
                if (!fflush($stateHandle)) throw new RuntimeException('State flush failed');
            } catch (Throwable $error) {
                ftruncate($month, $oldSize);
                rewind($stateHandle);
                $oldState = FB_GUARD . $stateRaw;
                fb_write_all($stateHandle, $oldState);
                ftruncate($stateHandle, strlen($oldState));
                throw $error;
            } finally { fclose($stateHandle); }
        } finally { fclose($month); }
        return ['receipt' => $receipt, 'retry_after' => FB_INTERVAL, 'duplicate' => false];
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
