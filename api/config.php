<?php
// The real API key is supplied by the server process environment only.
if (!defined('LAB_IMAGE_IMPORT')) {
    http_response_code(404);
    exit;
}
return [
    'api_key' => getenv('DEEPSEEK_API_KEY') ?: '',
    'model' => getenv('DEEPSEEK_MODEL') ?: 'deepseek-flash',
    'interval_seconds' => (int) (getenv('LAB_IMAGE_IMPORT_INTERVAL') ?: 60),
];
