<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function index()
    {
        return view('pages.checkout.index');
    }

    public function process(Request $request)
    {
        session()->forget('cart');
        return redirect('/')->with('success', 'Order has been placed successfully!');
    }
}
