<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class IfAndUnlessController extends Controller
{
    public function show()
    {
        $isLoggedIn = true; // Hoặc false
        $userName = 'Alex Mai';
        return view('ifandunless', ['isLoggedIn' => $isLoggedIn, 'userName' => $userName]);
    }
}
