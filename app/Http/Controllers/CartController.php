<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;

class CartController extends Controller
{
    public function index()
    {
        $cartItems = session()->get('cart', []);
        return view('pages.cart.index', compact('cartItems'));
    }

    public function add($id)
    {
        try {
            $product = Product::findOrFail($id);
        } catch (\Exception $e) {
            $product = (object)['id' => $id, 'name' => 'Sản phẩm demo ' . $id, 'price' => 500000];
        }

        $cart = session()->get('cart', []);
        $cart[$id] = $product;
        session()->put('cart', $cart);

        return redirect('/cart');
    }

    public function remove($id)
    {
        $cart = session()->get('cart', []);
        unset($cart[$id]);
        session()->put('cart', $cart);

        return redirect('/cart');
    }
}
