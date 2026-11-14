<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Requests\RegisterUserRequest;
use App\Models\User;

class RegisterUserController extends Controller
{
    public function register(RegisterUserRequest $request)
    {
        // Xử lý dữ liệu sau khi xác thực
        // $validated = $request->validated();
        // User::create($validated);
        return 'User registered successfully.';
    }
}
