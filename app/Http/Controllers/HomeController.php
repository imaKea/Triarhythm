<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;

class HomeController extends Controller
{
    public function index()
    {
        try {
            $products = Product::all()->take(8);
        } catch (\Exception $e) {
            $products = collect();
        }
        return view('pages.home', compact('products'));
    }
}
