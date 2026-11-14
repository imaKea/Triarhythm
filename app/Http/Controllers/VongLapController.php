<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class VongLapController extends Controller
{
    public function show()
    {
        $items = ['Item 1', 'Item 2', 'Item 3'];
        $products = [
            (object)['name' => 'Macbook Air M2 13 inch 2022 8CPU 10GPU/16GB/512GB', 'price' => '33490000'],
            (object)['name' => 'Macbook Air M3 13 2024 8CPU 10GPU/16GB/512GB', 'price' => '37990000'],
            (object)['name' => 'iPhone 15 Pro Max 256GB', 'price' => '29490000'],
        ];
        return view('vonglap', ['items' => $items, 'products' => $products]);
    }
}
