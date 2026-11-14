<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ShowProfileController extends Controller
{
    public function ShowProfile()
    {
        $name = 'Alex Mai';
        $age = 50;
        $location = 'Hồ Chí Minh';
        return view('profiledungcompact', compact('name', 'age', 'location'));
    }
}
