<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class BookController extends Controller
{
    private static $books = [
        ['id' => 1, 'title' => 'Laravel for Beginners', 'author' => 'John Doe', 'year' => 2021],
        ['id' => 2, 'title' => 'Mastering Laravel', 'author' => 'Alex Mai', 'year' => 2022],
        ['id' => 3, 'title' => 'Laravel in Action', 'author' => 'James Smith', 'year' => 2020],
    ];

    public function index()
    {
        return view('books.index', ['books' => self::$books]);
    }

    public function create()
    {
        return view('books.create');
    }

    public function store(Request $request)
    {
        $newBook = [
            'id' => count(self::$books) + 1,
            'title' => $request->input('title'),
            'author' => $request->input('author'),
            'year' => $request->input('year'),
        ];
        self::$books[] = $newBook;
        return redirect()->route('books.index');
    }

    public function show($id)
    {
        $book = collect(self::$books)->firstWhere('id', $id);
        return view('books.show', ['book' => $book]);
    }

    public function edit($id)
    {
        $book = collect(self::$books)->firstWhere('id', $id);
        return view('books.edit', ['book' => $book]);
    }

    public function update(Request $request, $id)
    {
        $bookKey = array_search($id, array_column(self::$books, 'id'));
        if ($bookKey !== false) {
            self::$books[$bookKey]['title'] = $request->input('title');
            self::$books[$bookKey]['author'] = $request->input('author');
            self::$books[$bookKey]['year'] = $request->input('year');
        }
        return redirect()->route('books.index');
    }

    public function destroy($id)
    {
        self::$books = array_filter(self::$books, function ($book) use ($id) {
            return $book['id'] != $id;
        });
        return redirect()->route('books.index');
    }
}
