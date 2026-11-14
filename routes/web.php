<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
| Backend này chỉ phục vụ API cho Triarhythm (xem routes/api.php).
| Frontend React được build riêng bằng Vite (dist/).
*/

Route::get('/', function () {
    return response()->json([
        'app' => 'Triarhythm API',
        'status' => 'ok',
        'api' => '/api',
    ]);
});
