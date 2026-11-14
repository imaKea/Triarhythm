<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class DangNhapController extends Controller
{
    public function login(Request $request)
    {
        $email = $request->input('email');
        $password = $request->input('password');

        // Kiểm tra thông tin đăng nhập (ví dụ: so sánh với dữ liệu trong cơ sở dữ liệu)
        if ($email === 'sv@lttc.edu.vn' && $password === '123456') {
            // Đăng nhập thành công
            return 'Dang nhap thành công';
        } else {
            // Đăng nhập thất bại
            return  'Email hoặc mật khẩu không đúng.';
        }
    }
}
