<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class UserUpdateController extends Controller
{
    public function edit(){
        //gia lap du lieu nguoi dung
        $user = [
            'email' => 'sv@lttc.edu.vn',
            'password' => '123456'
        ];
        return view('useredit', compact('user'));
    }
    public function update(Request $request){
        $user=$request->only('email','password');
        return view('resultuserupdate', compact('user'));
    }
}
