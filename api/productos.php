<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$metodo = $_SERVER["REQUEST_METHOD"];

if ($metodo === "GET") {
    try {
        $sql = "
            SELECT 
                p.id_producto,
                p.nombre,
                p.descripcion,
                p.id_categoria,
                p.precio_compra,
                p.precio_venta,
                p.inventario,
                p.stock_minimo,
                p.stock_maximo,
                p.estado,
                p.en_oferta,
                p.destacado,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM ProveedorProductos pp 
                        WHERE pp.id_producto = p.id_producto
                    ) 
                    THEN 1 
                    ELSE 0 
                END AS tiene_proveedor,
                c.nombre AS categoria
            FROM Productos p
            LEFT JOIN Categorias c 
                ON p.id_categoria = c.id_categoria
            ORDER BY p.id_producto DESC
        ";

        $stmt = $pdo->query($sql);
        $productos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($productos);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al consultar productos: " . $e->getMessage()
        ]);
        exit;
    }
}

if ($metodo === "POST") {
    try {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibieron datos válidos"
            ]);
            exit;
        }

        if (empty($data["nombre"])) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "El nombre del producto es obligatorio"
            ]);
            exit;
        }

        $sql = "
            INSERT INTO Productos 
            (
                nombre, 
                descripcion, 
                id_categoria, 
                precio_compra, 
                precio_venta, 
                inventario, 
                stock_minimo, 
                stock_maximo,
                estado,
                en_oferta,
                destacado
            )
            VALUES 
            (
                :nombre, 
                :descripcion, 
                :id_categoria, 
                :precio_compra, 
                :precio_venta, 
                :inventario, 
                :stock_minimo, 
                :stock_maximo,
                :estado,
                :en_oferta,
                :destacado
            )
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ":nombre" => $data["nombre"],
            ":descripcion" => $data["descripcion"] ?? "",
            ":id_categoria" => $data["id_categoria"] ?? null,
            ":precio_compra" => $data["precio_compra"] ?? 0,
            ":precio_venta" => $data["precio_venta"] ?? 0,
            ":inventario" => $data["inventario"] ?? 0,
            ":stock_minimo" => $data["stock_minimo"] ?? 10,
            ":stock_maximo" => $data["stock_maximo"] ?? 100,
            ":estado" => $data["estado"] ?? "activo",
            ":en_oferta" => !empty($data["en_oferta"]) ? 1 : 0,
            ":destacado" => !empty($data["destacado"]) ? 1 : 0
        ]);

        echo json_encode([
            "ok" => true,
            "mensaje" => "Producto creado correctamente"
        ]);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al crear producto: " . $e->getMessage()
        ]);
        exit;
    }
}

if ($metodo === "PUT") {
    try {
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibieron datos válidos"
            ]);
            exit;
        }

        if (empty($data["id_producto"])) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibió el ID del producto"
            ]);
            exit;
        }

        if (empty($data["nombre"])) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "El nombre del producto es obligatorio"
            ]);
            exit;
        }

        $sql = "
            UPDATE Productos SET
                nombre = :nombre,
                descripcion = :descripcion,
                id_categoria = :id_categoria,
                precio_compra = :precio_compra,
                precio_venta = :precio_venta,
                inventario = :inventario,
                stock_minimo = :stock_minimo,
                stock_maximo = :stock_maximo,
                estado = :estado,
                en_oferta = :en_oferta,
                destacado = :destacado
            WHERE id_producto = :id_producto
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ":id_producto" => $data["id_producto"],
            ":nombre" => $data["nombre"],
            ":descripcion" => $data["descripcion"] ?? "",
            ":id_categoria" => $data["id_categoria"] ?? null,
            ":precio_compra" => $data["precio_compra"] ?? 0,
            ":precio_venta" => $data["precio_venta"] ?? 0,
            ":inventario" => $data["inventario"] ?? 0,
            ":stock_minimo" => $data["stock_minimo"] ?? 10,
            ":stock_maximo" => $data["stock_maximo"] ?? 100,
            ":estado" => $data["estado"] ?? "activo",
            ":en_oferta" => !empty($data["en_oferta"]) ? 1 : 0,
            ":destacado" => !empty($data["destacado"]) ? 1 : 0
        ]);

        echo json_encode([
            "ok" => true,
            "mensaje" => "Producto actualizado correctamente"
        ]);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al actualizar producto: " . $e->getMessage()
        ]);
        exit;
    }
}

if ($metodo === "DELETE") {
    try {
        $id = $_GET["id"] ?? null;

        if (!$id) {
            echo json_encode([
                "ok" => false,
                "mensaje" => "No se recibió el ID del producto"
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM Productos WHERE id_producto = :id");
        $stmt->execute([":id" => $id]);

        echo json_encode([
            "ok" => true,
            "mensaje" => "Producto eliminado correctamente"
        ]);
        exit;

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Error al eliminar producto: " . $e->getMessage()
        ]);
        exit;
    }
}

echo json_encode([
    "ok" => false,
    "mensaje" => "Método no permitido"
]);