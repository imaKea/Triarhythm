<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function calculateTotal(Request $request)
    {
        $name = $request->input('name');
        $quantity = $request->input('quantity');
        $price = $request->input('price');
        $result = $quantity * $price;
        $data = [
            'name' => $name,
            'quantity' => $quantity,
            'price' => $price,
            'result' => $result
        ];
        return view('orderresult', ['data' => $data]);
    }
}
