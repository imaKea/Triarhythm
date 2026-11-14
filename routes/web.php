<?php

use App\Http\Controllers\Admin\users\LoginController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\DangNhapController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\IfAndUnlessController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\RegisterUserController;
use App\Http\Controllers\ShowProfileController;
use App\Http\Controllers\SwitchController;
use App\Http\Controllers\UserUpdateController;
use App\Http\Controllers\VongLapController;
use App\Http\Controllers\WelcomeController;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| CHƯƠNG 3: LARAVEL CĂN BẢN
|--------------------------------------------------------------------------
*/

// --- BÀI 1: SỬ DỤNG ROUTE, VIEW VÀ CONTROLLER ---
//1.1
Route::get('/', function () {
    return 'Welcome to Laravel';
});
Route::get('/GioiThieu', function () {
    return 'Đây là trang giới thiệu';
});

//1.2
Route::get('chao', function () {
    return view('chao');
});

//1.3
Route::get('chao/{name}', function ($name) {
    return 'chao ' . $name;
});

//1.4
Route::get('/welcome', [WelcomeController::class, 'index'])->name('home'); //them ->name('home') de dat ten cho route cua cau 1.8

//1.5
Route::get('/dangnhap', function () {
    return view('dangnhap');
});
Route::post('/login', [DangNhapController::class, 'login']);

//1.6
Route::get('/user/edit', [UserUpdateController::class, 'edit'])->name('useredit');
Route::put('/user/update', [UserUpdateController::class, 'update'])->name('userupdate');

//1.7
Route::redirect('/old-path', '/new-path', 301);

//1.8, len 1.4 de them ->name('home') de dat ten cho route cua cau 1.8
Route::get('/about', function () {
    return view('about');
})->name('about');

Route::get('/contact', function () {
    return view('contact');
})->name('contact');
Route::redirect('/home', '/', 301);

//1.9
Route::group(['prefix' => 'admin', 'namespace' => 'App\Http\Controllers'], function () {
    Route::get('dashboard', 'AdminController@dashboard')->name('admin.dashboard');
    Route::get('setting', 'AdminController@setting')->name('admin.setting');
});

//1.10
Route::any('/search', function (Request $request) {
    $keyword = $request->input('keyword');
    //gia lap du lieu san pham
    $products = [
        ['id' => 1, 'name' => 'San pham 1'],
        ['id' => 2, 'name' => 'San pham 2'],
        ['id' => 3, 'name' => 'San pham 3'],
    ];
    $results = [];
    if ($keyword) {
        foreach ($products as $product) {
            if (stripos($product['name'], $keyword) !== false) {
                $results[] = $product;
            }
        }
    }
    return view('search', compact('results', 'keyword'));
})->name('search');


// --- BÀI 2: SỬ DỤNG CONTROLLER TRONG LARAVEL ---
//2.1
Route::get('/orderform', function () {
    return view('OrderForm');
});
Route::post('/order-form-submit', [OrderController::class, 'calculateTotal']);

//2.2
Route::resource('books', App\Http\Controllers\BookController::class);


// --- BÀI 3: SỬ DỤNG VIEW VÀ BLADE TEMPLATE TRONG LARAVEL ---
//3.1: Truyền dữ liệu từ Route qua View Profile dùng Mảng
Route::get('/profiledungmang', function () {
    $data = [
        'name' => 'Alex Mai',
        'age' => 50,
        'location' => 'Hồ Chí Minh'
    ];
    return view('profiledungmang', ['data' => $data]);
});

//3.2: Truyền dữ liệu từ Route qua View Profile dùng With
Route::get('/profiledungwith', function () {
    return view('profiledungwith')
        ->with('name', 'Alex Mai')
        ->with('age', 50)
        ->with('location', 'Hồ Chí Minh');
});

//3.3: Truyền dữ liệu từ Controller qua View Profile dùng Compact
Route::get('/profiledungcompact', [ShowProfileController::class, 'ShowProfile']);

//3.4: Sử dụng câu lệnh @if và @unless trong blade template
Route::get('/ifandunless', [IfAndUnlessController::class, 'show']);

//3.5: Sử dụng câu lệnh @switch trong blade template
Route::get('/switchview', [SwitchController::class, 'show']);

//3.6: Sử dụng vòng lặp trong Blade Template
Route::get('/vonglap', [VongLapController::class, 'show']);

//3.7: Sử dụng View và Blade Template (Demo tĩnh)
Route::get('/store-home', function () {
    return view('home');
});

//3.8: Xây dựng Website cửa hàng Thời trang bằng Laravel (Fashion Store)
Route::get('/fashion', [HomeController::class, 'index'])->name('fashion.home');
Route::get('/cart', [CartController::class, 'index'])->name('cart.index');
Route::get('/cart/add/{id}', [CartController::class, 'add'])->name('cart.add');
Route::get('/cart/remove/{id}', [CartController::class, 'remove'])->name('cart.remove');
Route::get('/checkout', [CheckoutController::class, 'index'])->name('checkout.index');
Route::post('/checkout', [CheckoutController::class, 'process'])->name('checkout.process');
Route::get('/news', [NewsController::class, 'index'])->name('news.index');
Route::get('/news/{id}', [NewsController::class, 'show'])->name('news.show');


// --- BÀI 4: SỬ DỤNG REQUEST, RESPONSE VÀ VALIDATION ---
//4.1: Validation trực tiếp trong Controller
Route::get('/login', [LoginController::class, 'login'])->name('login');
Route::post('/userlogin', [LoginController::class, 'userlogin'])->name('userlogin');

//4.2: Validation Form Request trong Controller
Route::get('/register', function () {
    return view('users.register');
})->name('register');
Route::post('/register', [RegisterUserController::class, 'register'])->name('register.post');


/*
|--------------------------------------------------------------------------
| CHƯƠNG 4: LÀM VIỆC VỚI DATABASE
|--------------------------------------------------------------------------
*/

// --- BÀI 2: THÊM DỮ LIỆU ---
// 2.1: Sử dụng Model Eloquent để thêm dữ liệu (Category)
Route::get('/add-category-controller', [CategoryController::class, 'addCategory']);
Route::get('/add-category-route', function () {
    Category::create([
        'name' => 'Công nghệ',
        'description' => 'Chuyên mục thông tin về Công nghệ',
    ]);
    Category::create([
        'name' => 'Sức khỏe',
        'description' => 'Chuyên mục thông tin về Sức khỏe',
    ]);
    Category::create([
        'name' => 'Giáo dục',
        'description' => 'Chuyên mục thông tin về Giáo dục',
    ]);
    return 'Categories được thêm bằng Model Eloquent thành công từ route!';
});

// 2.2: Sử dụng Query Builder để thêm dữ liệu (Post)
Route::get('/add-post-controller', [PostController::class, 'addpost']);
Route::get('/add-post-route', function () {
    $catId = Category::first()->id ?? 1;
    DB::table('posts')->insert([
        [
            'name' => 'Bài viết 4',
            'description' => 'Mô tả bài viết 4',
            'content' => 'Nội dung chi tiết của bài viết 4',
            'category_id' => $catId,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'name' => 'Bài viết 5',
            'description' => 'Mô tả bài viết 5',
            'content' => 'Nội dung chi tiết của bài viết 5',
            'category_id' => $catId,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'name' => 'Bài viết 6',
            'description' => 'Mô tả bài viết 6',
            'content' => 'Nội dung chi tiết của bài viết 6',
            'category_id' => $catId,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);
    return 'Posts được thêm bằng Query Builder thành công từ route!';
});


// --- BÀI 3: CẬP NHẬT DỮ LIỆU ---
// 3.1: Cập nhật dữ liệu bằng Eloquent ORM (Category)
Route::get('/update-category-controller', [CategoryController::class, 'Update']);
Route::get('/update-category-route', function () {
    $category = Category::where('name', 'Bóng đá')->first() ?? Category::first();
    if ($category) {
        $category->name = 'Thể thao';
        $category->description = 'Chuyên mục thông tin về Thể thao';
        $category->save();
        return 'Category được cập nhật bằng Eloquent ORM thành công từ route!';
    }
    return 'Category không tìm thấy';
});

// 3.2: Cập nhật dữ liệu bằng Query Builder (Post)
Route::get('/update-post-controller/{id}', [PostController::class, 'updatePost']);
Route::get('/update-post-route/{id}', function ($id) {
    DB::table('posts')
        ->where('id', $id)
        ->update([
            'name' => 'Tên của Post có ID = ' . $id . ' đã được cập nhật',
            'description' => 'Mô tả của Post có ID = ' . $id . ' đã được cập nhật',
            'content' => 'Nội dung của Post có ID = ' . $id . ' đã được cập nhật'
        ]);
    return 'Post có ID=' . $id . ' đã được cập nhật từ Route!';
});


// --- BÀI 4: XÓA DỮ LIỆU ---
// 4.1: Xóa dữ liệu bằng Eloquent ORM (Category)
Route::get('/delete-category-controller/{id}', [CategoryController::class, 'Delete']);
Route::get('/delete-category-route/{id}', function ($id) {
    $category = Category::find($id);
    if ($category) {
        $category->delete();
        return 'Category có ID=' . $id . ' đã được xóa thành công!';
    }
    return 'Category có ID=' . $id . ' không tìm thấy';
});

// 4.2: Xóa dữ liệu bằng Query Builder (Post)
Route::get('/delete-post-controller/{id}', [PostController::class, 'deletePost']);
Route::get('/delete-post-route/{id}', function ($id) {
    $deleted = DB::table('posts')->where('id', $id)->delete();
    if ($deleted) {
        return 'Post có ID = ' . $id . ' được xóa thành công từ Route!';
    } else {
        return 'Post có ID = ' . $id . ' không tìm thấy.';
    }
});


// --- BÀI 7: TRUY VẤN VÀ LỌC DỮ LIỆU ---
// 7.1: Sử dụng Eloquent ORM để truy vấn và lọc dữ liệu (Category)
Route::get('/categories', [CategoryController::class, 'listEloquentwhereLike'])->name('categories.list');

// 7.2: Sử dụng Query Builder để truy vấn và lọc dữ liệu (Post)
Route::get('/posts', [PostController::class, 'listQueryBuilderwhereLike'])->name('posts.list');


// --- BÀI 8: PHÂN TRANG DỮ LIỆU ---
// 8.1: Sử dụng Eloquent ORM để phân trang (Post)
Route::get('/postspage-Eloquent', [PostController::class, 'listPostEloquentPaginate10'])->name('posts.page.eloquent');

// 8.2: Sử dụng Query Builder để phân trang (Post)
Route::get('/postspage-QueryBuilder', [PostController::class, 'listPostQueryBuilderPaginate10'])->name('posts.page.querybuilder');


// --- BÀI 9: XÂY DỰNG TRANG WEB QUẢN LÝ SẢN PHẨM CƠ BẢN ---
Route::resource('products', ProductController::class);
Route::get('/listproducts', [ProductController::class, 'listproducts'])->name('products.listproducts');
