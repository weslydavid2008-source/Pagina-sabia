<?php
session_start();

header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

$method = $_SERVER["REQUEST_METHOD"];
$accion = $_GET["accion"] ?? "";

if ($method === "GET" && $accion === "init") {
    cargarDatosIniciales($pdo);
    exit;
}

if ($method === "POST") {
    crearPedido($pdo);
    exit;
}

responder([
    "ok" => false,
    "mensaje" => "Método no permitido."
], 405);

function cargarDatosIniciales($pdo) {
    $idUsuario = obtenerIdUsuarioSesion();
    $barrios = obtenerBarrios($pdo);

    if (!$idUsuario) {
        responder([
            "ok" => true,
            "logueado" => false,
            "usuario" => null,
            "barrios" => $barrios
        ]);
    }

    $usuario = obtenerUsuarioCompleto($pdo, $idUsuario);

    responder([
        "ok" => true,
        "logueado" => $usuario !== null,
        "usuario" => $usuario,
        "barrios" => $barrios
    ]);
}

function crearPedido($pdo) {
    $idUsuario = obtenerIdUsuarioSesion();

    if (!$idUsuario) {
        responder([
            "ok" => false,
            "mensaje" => "Debes iniciar sesión para finalizar la compra."
        ], 401);
    }

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        responder([
            "ok" => false,
            "mensaje" => "JSON inválido."
        ], 400);
    }

    $envio = $input["envio"] ?? [];
    $metodoPago = $input["metodo_pago"] ?? "efectivo";

    try {
        $pdo->beginTransaction();

        $carrito = obtenerCarritoActivoUsuario($pdo, $idUsuario);

        if (!is_array($carrito) || count($carrito) === 0) {
            throw new Exception("El carrito está vacío.");
        }

        $usuario = obtenerUsuarioCompleto($pdo, $idUsuario);

        if (!$usuario) {
            throw new Exception("Usuario no encontrado o inactivo.");
        }

        $nombre = trim($envio["nombre"] ?? $usuario["nombre_completo"]);
        $correo = trim($envio["correo"] ?? $usuario["correo"]);
        $telefono = trim($envio["telefono"] ?? ($usuario["telefono"] ?? ""));
        $direccionEntrega = trim($envio["direccion_entrega"] ?? "");
        $referencia = trim($envio["referencia"] ?? "");
        $idBarrio = $envio["id_barrio"] ?? ($usuario["id_barrio"] ?? null);
        $costoDomicilio = isset($envio["costo_domicilio"])
            ? (float) $envio["costo_domicilio"]
            : 3990;

        if ($nombre === "" || $correo === "" || $telefono === "" || $direccionEntrega === "") {
            throw new Exception("Completa nombre, correo, teléfono y dirección.");
        }

        $idCliente = obtenerOCrearCliente(
            $pdo,
            $usuario,
            $nombre,
            $correo,
            $telefono,
            $direccionEntrega,
            $idBarrio
        );

        $productosPedido = validarYPrepararProductos($pdo, $carrito);

        $subtotal = calcularSubtotal($productosPedido);
        $totalIva = 0;
        $totalDescuento = 0;
        $pagoTotal = $subtotal + $costoDomicilio;

        $idDomicilio = crearDomicilio(
            $pdo,
            $idCliente,
            $direccionEntrega,
            $idBarrio,
            $referencia,
            $costoDomicilio
        );

        $idVenta = crearVenta(
            $pdo,
            $idCliente,
            $usuario["id_usuario"],
            $idDomicilio,
            $subtotal,
            $totalIva,
            $totalDescuento,
            $costoDomicilio,
            $pagoTotal
        );

        crearDetalleVenta($pdo, $idVenta, $productosPedido);
        vaciarCarritoActivoUsuario($pdo, $idUsuario);

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Pedido creado correctamente.",
            "id_venta" => $idVenta,
            "subtotal" => $subtotal,
            "costo_domicilio" => $costoDomicilio,
            "total" => $pagoTotal,
            "metodo_pago" => $metodoPago
        ]);

    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => $error->getMessage()
        ], 500);
    }
}

function obtenerIdUsuarioSesion() {
    if (isset($_SESSION["id_usuario"])) {
        return (int) $_SESSION["id_usuario"];
    }

    if (isset($_SESSION["usuario"]["id_usuario"])) {
        return (int) $_SESSION["usuario"]["id_usuario"];
    }

    if (isset($_SESSION["usuario"]["id"])) {
        return (int) $_SESSION["usuario"]["id"];
    }

    return null;
}

function obtenerUsuarioCompleto($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        SELECT
            u.id_usuario,
            u.nombre,
            u.apellido,
            u.correo,
            u.telefono,
            u.direccion,
            u.estado,
            r.nombre AS rol
        FROM Usuarios u
        INNER JOIN Roles r
            ON r.id_rol = u.id_rol
        WHERE u.id_usuario = :id_usuario
        LIMIT 1
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);

    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario || $usuario["estado"] !== "activo") {
        return null;
    }

    $stmtCliente = $pdo->prepare("
        SELECT
            c.id_cliente,
            c.documento,
            c.id_genero,
            g.genero,
            c.id_barrio,
            b.nombre AS barrio,
            c.telefono AS cliente_telefono,
            c.direccion AS cliente_direccion
        FROM Clientes c
        LEFT JOIN Generos g
            ON g.id_genero = c.id_genero
        LEFT JOIN Barrios b
            ON b.id_barrio = c.id_barrio
        WHERE c.id_usuario = :id_usuario
           OR c.correo = :correo
        ORDER BY c.id_usuario DESC
        LIMIT 1
    ");

    $stmtCliente->execute([
        ":id_usuario" => $usuario["id_usuario"],
        ":correo" => $usuario["correo"]
    ]);

    $cliente = $stmtCliente->fetch(PDO::FETCH_ASSOC);

    $nombreCompleto = trim(($usuario["nombre"] ?? "") . " " . ($usuario["apellido"] ?? ""));

    return [
        "id_usuario" => (int) $usuario["id_usuario"],
        "nombre" => $usuario["nombre"],
        "apellido" => $usuario["apellido"],
        "nombre_completo" => $nombreCompleto,
        "correo" => $usuario["correo"],
        "telefono" => $cliente["cliente_telefono"] ?? $usuario["telefono"],
        "direccion" => $cliente["cliente_direccion"] ?? $usuario["direccion"],
        "rol" => $usuario["rol"],

        "id_cliente" => $cliente && $cliente["id_cliente"]
            ? (int) $cliente["id_cliente"]
            : null,

        "documento" => $cliente["documento"] ?? null,
        "id_genero" => $cliente["id_genero"] ?? null,
        "genero" => $cliente["genero"] ?? null,
        "id_barrio" => $cliente["id_barrio"] ?? null,
        "barrio" => $cliente["barrio"] ?? null
    ];
}

function obtenerBarrios($pdo) {
    $stmt = $pdo->query("
        SELECT id_barrio, nombre
        FROM Barrios
        ORDER BY nombre ASC
    ");

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function obtenerOCrearCliente($pdo, $usuario, $nombreCompleto, $correo, $telefono, $direccion, $idBarrio) {
    $partesNombre = separarNombreApellido($nombreCompleto);

    if (!empty($usuario["id_cliente"])) {
        $stmt = $pdo->prepare("
            UPDATE Clientes SET
                id_usuario = :id_usuario,
                nombre = :nombre,
                apellido = :apellido,
                correo = :correo,
                telefono = :telefono,
                direccion = :direccion,
                id_barrio = :id_barrio
            WHERE id_cliente = :id_cliente
        ");

        $stmt->execute([
            ":id_usuario" => $usuario["id_usuario"],
            ":nombre" => $partesNombre["nombre"],
            ":apellido" => $partesNombre["apellido"],
            ":correo" => $correo,
            ":telefono" => $telefono,
            ":direccion" => $direccion,
            ":id_barrio" => $idBarrio ?: null,
            ":id_cliente" => $usuario["id_cliente"]
        ]);

        return (int) $usuario["id_cliente"];
    }

    $stmtBuscar = $pdo->prepare("
        SELECT id_cliente
        FROM Clientes
        WHERE correo = :correo
        LIMIT 1
    ");

    $stmtBuscar->execute([
        ":correo" => $correo
    ]);

    $clienteExistente = $stmtBuscar->fetch(PDO::FETCH_ASSOC);

    if ($clienteExistente) {
        $idCliente = (int) $clienteExistente["id_cliente"];

        $stmtUpdate = $pdo->prepare("
            UPDATE Clientes SET
                id_usuario = :id_usuario,
                nombre = :nombre,
                apellido = :apellido,
                telefono = :telefono,
                direccion = :direccion,
                id_barrio = :id_barrio
            WHERE id_cliente = :id_cliente
        ");

        $stmtUpdate->execute([
            ":id_usuario" => $usuario["id_usuario"],
            ":nombre" => $partesNombre["nombre"],
            ":apellido" => $partesNombre["apellido"],
            ":telefono" => $telefono,
            ":direccion" => $direccion,
            ":id_barrio" => $idBarrio ?: null,
            ":id_cliente" => $idCliente
        ]);

        return $idCliente;
    }

    $stmtInsert = $pdo->prepare("
        INSERT INTO Clientes (
            id_usuario,
            nombre,
            apellido,
            correo,
            direccion,
            id_barrio,
            telefono
        ) VALUES (
            :id_usuario,
            :nombre,
            :apellido,
            :correo,
            :direccion,
            :id_barrio,
            :telefono
        )
    ");

    $stmtInsert->execute([
        ":id_usuario" => $usuario["id_usuario"],
        ":nombre" => $partesNombre["nombre"],
        ":apellido" => $partesNombre["apellido"],
        ":correo" => $correo,
        ":direccion" => $direccion,
        ":id_barrio" => $idBarrio ?: null,
        ":telefono" => $telefono
    ]);

    return (int) $pdo->lastInsertId();
}

function separarNombreApellido($nombreCompleto) {
    $partes = preg_split("/\s+/", trim($nombreCompleto));

    if (!$partes || count($partes) === 0) {
        return [
            "nombre" => "Cliente",
            "apellido" => ""
        ];
    }

    $nombre = array_shift($partes);
    $apellido = implode(" ", $partes);

    return [
        "nombre" => $nombre,
        "apellido" => $apellido
    ];
}


function obtenerCarritoActivoUsuario($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        SELECT
            dc.id_producto,
            dc.cantidad
        FROM Carritos c
        INNER JOIN DetalleCarrito dc
            ON dc.id_carrito = c.id_carrito
        WHERE c.id_usuario = :id_usuario
          AND c.estado = 'activo'
        ORDER BY dc.fecha_agregado ASC, dc.id_detalle_carrito ASC
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function vaciarCarritoActivoUsuario($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        DELETE dc
        FROM DetalleCarrito dc
        INNER JOIN Carritos c
            ON c.id_carrito = dc.id_carrito
        WHERE c.id_usuario = :id_usuario
          AND c.estado = 'activo'
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);
}

function validarYPrepararProductos($pdo, $carrito) {
    $productos = [];

    $stmt = $pdo->prepare("
        SELECT
            p.id_producto,
            p.nombre,
            p.precio_venta AS precio_original,

            COALESCE(o.precio_oferta, p.precio_venta) AS precio_final,
            o.precio_oferta,

            CASE
                WHEN o.id_oferta IS NOT NULL THEN 1
                ELSE 0
            END AS tiene_oferta,

            p.inventario,
            p.estado

        FROM Productos p

        LEFT JOIN Ofertas o
            ON o.id_producto = p.id_producto
            AND o.estado = 'activa'
            AND CURDATE() BETWEEN o.fecha_inicio AND o.fecha_fin

        WHERE p.id_producto = :id_producto
        LIMIT 1
        FOR UPDATE
    ");

    foreach ($carrito as $item) {
        $idProducto = isset($item["id_producto"]) ? (int) $item["id_producto"] : 0;
        $cantidad = isset($item["cantidad"]) ? (int) $item["cantidad"] : 0;

        if ($idProducto <= 0 || $cantidad <= 0) {
            throw new Exception("Hay productos inválidos en el carrito.");
        }

        $stmt->execute([
            ":id_producto" => $idProducto
        ]);

        $producto = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$producto) {
            throw new Exception("Uno de los productos ya no existe.");
        }

        if ($producto["estado"] !== "activo") {
            throw new Exception("El producto " . $producto["nombre"] . " no está activo.");
        }

        if ((int) $producto["inventario"] < $cantidad) {
            throw new Exception("Stock insuficiente para " . $producto["nombre"] . ".");
        }

        $precioFinal = (float) $producto["precio_final"];

        $productos[] = [
            "id_producto" => (int) $producto["id_producto"],
            "nombre" => $producto["nombre"],
            "cantidad" => $cantidad,
            "precio_venta" => $precioFinal,
            "precio_original" => (float) $producto["precio_original"],
            "precio_oferta" => $producto["precio_oferta"] !== null ? (float) $producto["precio_oferta"] : null,
            "tiene_oferta" => (int) $producto["tiene_oferta"],
            "subtotal" => $precioFinal * $cantidad
        ];
    }

    return $productos;
}

function calcularSubtotal($productos) {
    $subtotal = 0;

    foreach ($productos as $producto) {
        $subtotal += (float) $producto["subtotal"];
    }

    return $subtotal;
}

function crearDomicilio($pdo, $idCliente, $direccionEntrega, $idBarrio, $referencia, $costoDomicilio) {
    $stmt = $pdo->prepare("
        INSERT INTO Domicilios (
            id_cliente,
            direccion_entrega,
            id_barrio,
            referencia,
            costo_domicilio,
            estado
        ) VALUES (
            :id_cliente,
            :direccion_entrega,
            :id_barrio,
            :referencia,
            :costo_domicilio,
            'pendiente'
        )
    ");

    $stmt->execute([
        ":id_cliente" => $idCliente,
        ":direccion_entrega" => $direccionEntrega,
        ":id_barrio" => $idBarrio ?: null,
        ":referencia" => $referencia,
        ":costo_domicilio" => $costoDomicilio
    ]);

    return (int) $pdo->lastInsertId();
}

function crearVenta($pdo, $idCliente, $idUsuario, $idDomicilio, $subtotal, $totalIva, $totalDescuento, $costoDomicilio, $pagoTotal) {
    $stmt = $pdo->prepare("
        INSERT INTO Ventas (
            id_cliente,
            id_usuario,
            id_domicilio,
            subtotal,
            total_iva,
            total_descuento,
            costo_domicilio,
            pago_total
        ) VALUES (
            :id_cliente,
            :id_usuario,
            :id_domicilio,
            :subtotal,
            :total_iva,
            :total_descuento,
            :costo_domicilio,
            :pago_total
        )
    ");

    $stmt->execute([
        ":id_cliente" => $idCliente,
        ":id_usuario" => $idUsuario,
        ":id_domicilio" => $idDomicilio,
        ":subtotal" => $subtotal,
        ":total_iva" => $totalIva,
        ":total_descuento" => $totalDescuento,
        ":costo_domicilio" => $costoDomicilio,
        ":pago_total" => $pagoTotal
    ]);

    return (int) $pdo->lastInsertId();
}

function crearDetalleVenta($pdo, $idVenta, $productos) {
    $stmt = $pdo->prepare("
        INSERT INTO DetalleVenta (
            id_venta,
            id_producto,
            cantidad,
            precio_venta,
            iva,
            descuento
        ) VALUES (
            :id_venta,
            :id_producto,
            :cantidad,
            :precio_venta,
            0,
            0
        )
    ");

    foreach ($productos as $producto) {
        $stmt->execute([
            ":id_venta" => $idVenta,
            ":id_producto" => $producto["id_producto"],
            ":cantidad" => $producto["cantidad"],
            ":precio_venta" => $producto["precio_venta"]
        ]);
    }
}

function responder($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}