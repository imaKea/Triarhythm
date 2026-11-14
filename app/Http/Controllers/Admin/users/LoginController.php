<?php

namespace App\Http\Controllers\Admin\users;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class LoginController extends Controller
{
    // Xử lý hiển thị View Login
    public function login()
    {
        return view('admin.users.login');
    }

    // Xử lý kiểm tra tính hợp lệ của dữ liệu (Validate)
    public function userlogin(Request $request)
    {
        $request->validate([
            'email' => 'required|email:filter',
            'password' => 'required|string|min:8',
        ]);

        // Code xử lý Login vào hệ thống
        return back()->with('success', 'Đăng nhập thành công!');
    }
}
