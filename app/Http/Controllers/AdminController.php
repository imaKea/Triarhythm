<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard(){
        return response()->json(['message'=> 'this is the admin dashboard page']);
    }
    public function setting(){
        return response()->json(['message'=> 'this is the admin setting page']);
    }
}
