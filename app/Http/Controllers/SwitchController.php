<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SwitchController extends Controller
{
    public function show()
    {
        $userRole = 'admin'; // 'admin', 'editor', 'viewer'
        return view('switchview', ['userRole' => $userRole]);
    }
}
