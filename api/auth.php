<?php
session_start();

header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

function responder($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function obtener_id_rol($pdo, $nombreRol) {
    $stmt = $pdo->prepare("
        SELECT id_rol
        FROM Roles
        WHERE nombre = :nombre
        LIMIT 1
    ");

    $stmt->execute([
        ":nombre" => $nombreRol
    ]);

    $rol = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$rol) {
        throw new Exception("No existe el rol: " . $nombreRol);
    }

    return $rol["id_rol"];
}

function obtener_usuario_actual($pdo) {
    if (empty($_SESSION["id_usuario"])) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT
            u.id_usuario,
            u.nombre,
            u.apellido,
            u.correo,
            u.telefono,
            u.direccion,
            u.estado,
            r.nombre AS rol,
            c.id_cliente,
            c.documento,
            c.id_genero,
            c.id_barrio,
            c.fecha_registro
        FROM Usuarios u
        INNER JOIN Roles r
            ON u.id_rol = r.id_rol
        LEFT JOIN Clientes c
            ON c.id_usuario = u.id_usuario
        WHERE u.id_usuario = :id_usuario
        LIMIT 1
    ");

    $stmt->execute([
        ":id_usuario" => $_SESSION["id_usuario"]
    ]);

    return $stmt->fetch(PDO::FETCH_ASSOC);
}


function asegurar_carrito_activo($pdo, $idUsuario) {
    $stmt = $pdo->prepare("
        INSERT INTO Carritos (id_usuario, estado)
        VALUES (:id_usuario, 'activo')
        ON DUPLICATE KEY UPDATE fecha_actualizacion = CURRENT_TIMESTAMP
    ");

    $stmt->execute([
        ":id_usuario" => $idUsuario
    ]);
}
function obtener_otp_registro_valido($pdo, $correo, $codigo, $bloquear = false) {
    $sql = "
        SELECT
            id_otp,
            correo,
            codigo,
            fecha_expiracion,
            usado,
            intentos
        FROM RegistroCorreoOtps
        WHERE correo = :correo
          AND usado = 0
        ORDER BY id_otp DESC
        LIMIT 1
    ";

    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        ":correo" => $correo
    ]);

    $otp = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$otp) {
        return null;
    }

    if ((int) $otp["intentos"] >= 5) {
        return null;
    }

    if (strtotime($otp["fecha_expiracion"]) < time()) {
        return null;
    }

    if ((string) $otp["codigo"] !== (string) $codigo) {
        aumentar_intentos_otp_registro($pdo, $otp["id_otp"]);
        return null;
    }

    return $otp;
}

function aumentar_intentos_otp_registro($pdo, $idOtp) {
    $stmt = $pdo->prepare("
        UPDATE RegistroCorreoOtps
        SET intentos = intentos + 1
        WHERE id_otp = :id_otp
        LIMIT 1
    ");

    $stmt->execute([
        ":id_otp" => $idOtp
    ]);
}

function marcar_otp_registro_usado($pdo, $idOtp) {
    $stmt = $pdo->prepare("
        UPDATE RegistroCorreoOtps
        SET usado = 1
        WHERE id_otp = :id_otp
        LIMIT 1
    ");

    $stmt->execute([
        ":id_otp" => $idOtp
    ]);
}
$metodo = $_SERVER["REQUEST_METHOD"];
$accion = $_GET["accion"] ?? null;
$data = json_decode(file_get_contents("php://input"), true);

if (!$accion && is_array($data)) {
    $accion = $data["accion"] ?? null;
}

if ($metodo === "GET" && $accion === "me") {
    $usuario = obtener_usuario_actual($pdo);

    if (!$usuario) {
        responder([
            "ok" => false,
            "logueado" => false
        ]);
    }

    asegurar_carrito_activo($pdo, (int) $usuario["id_usuario"]);

    responder([
        "ok" => true,
        "logueado" => true,
        "usuario" => $usuario
    ]);
}

if ($metodo === "POST" && $accion === "register") {
    try {
        $nombre = trim($data["nombre"] ?? "");
        $apellido = trim($data["apellido"] ?? "");
        $documento = trim($data["documento"] ?? "");
        $correo = trim($data["correo"] ?? "");
        $telefono = trim($data["telefono"] ?? "");
        $direccion = trim($data["direccion"] ?? "");
        $idGenero = $data["id_genero"] ?? null;
        $idBarrio = $data["id_barrio"] ?? null;
        $clave = $data["clave"] ?? "";
        $codigoOtp = trim($data["codigo_otp"] ?? "");

        if (!$nombre || !$correo || !$clave) {
            responder([
                "ok" => false,
                "mensaje" => "Nombre, correo y contraseña son obligatorios."
            ], 400);
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            responder([
                "ok" => false,
                "mensaje" => "Correo inválido."
            ], 400);
        }

        if (strlen($clave) < 6) {
            responder([
                "ok" => false,
                "mensaje" => "La contraseña debe tener mínimo 6 caracteres."
            ], 400);
        }

        if ($codigoOtp === "") {
            responder([
                "ok" => false,
                "mensaje" => "Debes verificar tu correo con el código OTP."
            ], 400);
        }

        $pdo->beginTransaction();

        $otpValido = obtener_otp_registro_valido($pdo, $correo, $codigoOtp, true);

        if (!$otpValido) {
            $pdo->rollBack();

            responder([
                "ok" => false,
                "mensaje" => "Código de verificación incorrecto, vencido o ya usado."
            ], 400);
        }

        $stmtCorreo = $pdo->prepare("
            SELECT id_usuario
            FROM Usuarios
            WHERE correo = :correo
            LIMIT 1
        ");

        $stmtCorreo->execute([
            ":correo" => $correo
        ]);

        if ($stmtCorreo->fetch(PDO::FETCH_ASSOC)) {
            $pdo->rollBack();

            responder([
                "ok" => false,
                "mensaje" => "Ese correo ya está registrado."
            ], 400);
        }

        if ($documento !== "") {
            $stmtDocumento = $pdo->prepare("
                SELECT id_cliente
                FROM Clientes
                WHERE documento = :documento
                LIMIT 1
            ");

            $stmtDocumento->execute([
                ":documento" => $documento
            ]);

            if ($stmtDocumento->fetch(PDO::FETCH_ASSOC)) {
                $pdo->rollBack();

                responder([
                    "ok" => false,
                    "mensaje" => "Ese documento ya está registrado."
                ], 400);
            }
        }

        $idRolUsuario = obtener_id_rol($pdo, "Usuario");

        // Guarda la contraseña normal, sin hash, como está tu sistema actual.
        $claveGuardada = $clave;

        $stmtUsuario = $pdo->prepare("
            INSERT INTO Usuarios
            (
                nombre,
                apellido,
                correo,
                clave,
                telefono,
                direccion,
                id_rol,
                estado
            )
            VALUES
            (
                :nombre,
                :apellido,
                :correo,
                :clave,
                :telefono,
                :direccion,
                :id_rol,
                'activo'
            )
        ");

        $stmtUsuario->execute([
            ":nombre" => $nombre,
            ":apellido" => $apellido,
            ":correo" => $correo,
            ":clave" => $claveGuardada,
            ":telefono" => $telefono,
            ":direccion" => $direccion,
            ":id_rol" => $idRolUsuario
        ]);

        $idUsuario = $pdo->lastInsertId();

        $stmtCliente = $pdo->prepare("
            INSERT INTO Clientes
            (
                id_usuario,
                nombre,
                apellido,
                documento,
                correo,
                direccion,
                id_genero,
                id_barrio,
                telefono
            )
            VALUES
            (
                :id_usuario,
                :nombre,
                :apellido,
                :documento,
                :correo,
                :direccion,
                :id_genero,
                :id_barrio,
                :telefono
            )
        ");

        $stmtCliente->execute([
            ":id_usuario" => $idUsuario,
            ":nombre" => $nombre,
            ":apellido" => $apellido,
            ":documento" => $documento ?: null,
            ":correo" => $correo,
            ":direccion" => $direccion,
            ":id_genero" => $idGenero ?: null,
            ":id_barrio" => $idBarrio ?: null,
            ":telefono" => $telefono
        ]);

        marcar_otp_registro_usado($pdo, $otpValido["id_otp"]);

        $_SESSION["id_usuario"] = $idUsuario;

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Cuenta creada correctamente.",
            "usuario" => obtener_usuario_actual($pdo)
        ]);

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($e->getCode() == 23000) {
            responder([
                "ok" => false,
                "mensaje" => "Ese correo o documento ya está registrado."
            ], 400);
        }

        responder([
            "ok" => false,
            "mensaje" => "Error al registrar: " . $e->getMessage()
        ], 500);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => $e->getMessage()
        ], 500);
    }
}

if ($metodo === "POST" && $accion === "login") {
    try {
        $correo = trim($data["correo"] ?? "");
        $clave = $data["clave"] ?? "";

        if (!$correo || !$clave) {
            responder([
                "ok" => false,
                "mensaje" => "Correo y contraseña son obligatorios."
            ], 400);
        }

        $stmt = $pdo->prepare("
            SELECT
                id_usuario,
                clave,
                estado
            FROM Usuarios
            WHERE correo = :correo
            LIMIT 1
        ");

        $stmt->execute([
            ":correo" => $correo
        ]);

        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$usuario) {
            responder([
                "ok" => false,
                "mensaje" => "Correo o contraseña incorrectos."
            ], 401);
        }

        $claveGuardada = $usuario["clave"];

        if ($clave !== $claveGuardada) {
            responder([
                "ok" => false,
                "mensaje" => "Correo o contraseña incorrectos."
            ], 401);
        }

        if ($usuario["estado"] !== "activo") {
            responder([
                "ok" => false,
                "mensaje" => "Este usuario está inactivo."
            ], 403);
        }

        $_SESSION["id_usuario"] = $usuario["id_usuario"];
        asegurar_carrito_activo($pdo, (int) $usuario["id_usuario"]);

        responder([
            "ok" => true,
            "mensaje" => "Sesión iniciada correctamente.",
            "usuario" => obtener_usuario_actual($pdo)
        ]);

    } catch (PDOException $e) {
        responder([
            "ok" => false,
            "mensaje" => "Error al iniciar sesión: " . $e->getMessage()
        ], 500);
    }
}

if ($metodo === "POST" && $accion === "logout") {
    session_unset();
    session_destroy();

    responder([
        "ok" => true,
        "mensaje" => "Sesión cerrada correctamente."
    ]);
}

if ($metodo === "POST" && $accion === "update_profile") {
    try {
        if (empty($_SESSION["id_usuario"])) {
            responder([
                "ok" => false,
                "mensaje" => "Debes iniciar sesión."
            ], 401);
        }

        $idUsuario = $_SESSION["id_usuario"];

        $nombre = trim($data["nombre"] ?? "");
        $apellido = trim($data["apellido"] ?? "");
        $documento = trim($data["documento"] ?? "");
        $correo = trim($data["correo"] ?? "");
        $telefono = trim($data["telefono"] ?? "");
        $direccion = trim($data["direccion"] ?? "");
        $idGenero = $data["id_genero"] ?? null;
        $idBarrio = $data["id_barrio"] ?? null;

        if (!$nombre || !$correo) {
            responder([
                "ok" => false,
                "mensaje" => "Nombre y correo son obligatorios."
            ], 400);
        }

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            responder([
                "ok" => false,
                "mensaje" => "Correo inválido."
            ], 400);
        }

        $pdo->beginTransaction();

        $stmtUsuario = $pdo->prepare("
            UPDATE Usuarios SET
                nombre = :nombre,
                apellido = :apellido,
                correo = :correo,
                telefono = :telefono,
                direccion = :direccion
            WHERE id_usuario = :id_usuario
        ");

        $stmtUsuario->execute([
            ":id_usuario" => $idUsuario,
            ":nombre" => $nombre,
            ":apellido" => $apellido,
            ":correo" => $correo,
            ":telefono" => $telefono,
            ":direccion" => $direccion
        ]);

        $stmtExiste = $pdo->prepare("
            SELECT id_cliente
            FROM Clientes
            WHERE id_usuario = :id_usuario
            LIMIT 1
        ");

        $stmtExiste->execute([
            ":id_usuario" => $idUsuario
        ]);

        $cliente = $stmtExiste->fetch(PDO::FETCH_ASSOC);

        if ($cliente) {
            $stmtCliente = $pdo->prepare("
                UPDATE Clientes SET
                    nombre = :nombre,
                    apellido = :apellido,
                    documento = :documento,
                    correo = :correo,
                    direccion = :direccion,
                    id_genero = :id_genero,
                    id_barrio = :id_barrio,
                    telefono = :telefono
                WHERE id_usuario = :id_usuario
            ");
        } else {
            $stmtCliente = $pdo->prepare("
                INSERT INTO Clientes
                (
                    id_usuario,
                    nombre,
                    apellido,
                    documento,
                    correo,
                    direccion,
                    id_genero,
                    id_barrio,
                    telefono
                )
                VALUES
                (
                    :id_usuario,
                    :nombre,
                    :apellido,
                    :documento,
                    :correo,
                    :direccion,
                    :id_genero,
                    :id_barrio,
                    :telefono
                )
            ");
        }

        $stmtCliente->execute([
            ":id_usuario" => $idUsuario,
            ":nombre" => $nombre,
            ":apellido" => $apellido,
            ":documento" => $documento ?: null,
            ":correo" => $correo,
            ":direccion" => $direccion,
            ":id_genero" => $idGenero ?: null,
            ":id_barrio" => $idBarrio ?: null,
            ":telefono" => $telefono
        ]);

        $pdo->commit();

        responder([
            "ok" => true,
            "mensaje" => "Perfil actualizado correctamente.",
            "usuario" => obtener_usuario_actual($pdo)
        ]);

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        responder([
            "ok" => false,
            "mensaje" => "Error al actualizar perfil: " . $e->getMessage()
        ], 500);
    }
}

responder([
    "ok" => false,
    "mensaje" => "Acción no permitida."
], 405);